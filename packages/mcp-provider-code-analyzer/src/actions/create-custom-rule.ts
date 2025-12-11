import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getErrorMessage } from "../utils.js";

export type SupportedEngine = 'pmd' | 'eslint' | 'regex';

export type CreateCustomRuleInput = {
    engine: SupportedEngine;
    language: string;
};

export type CreateCustomRuleOutput = {
    status: string;
    knowledgeBase?: KnowledgeBase;
    instructionsForLlm?: string;
    nextStep?: {
        action: string;
        then: string;
    };
    error?: string;
};

export type KnowledgeBase = {
    nodeIndex: string[];
    nodeInfo: Record<string, {
        description: string;
        category?: string;
        attributes: Array<{ name: string; type: string; description: string }>;
        note?: string;
    }>;
    xpathFunctions: Array<{ name: string; syntax: string; desc: string; returnType?: string; example?: string }>;
    importantNotes?: Array<{ title: string; content: string }>;
};

export interface CreateCustomRuleAction {
    exec(input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput>;
}

export class CreateCustomRuleActionImpl implements CreateCustomRuleAction {
    private readonly knowledgeBasePath: string;

    constructor(knowledgeBasePath?: string) {
        if (knowledgeBasePath) {
            this.knowledgeBasePath = knowledgeBasePath;
        } else {
            // Resources are copied to dist/resources during build, maintaining src structure
            const currentDir = path.dirname(fileURLToPath(import.meta.url));
            this.knowledgeBasePath = path.resolve(currentDir, '..', 'resources', 'custom-rules');
        }
    }

    async exec(input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput> {
        try {
            if (!this.engineSupportsCustomRules(input.engine)) {
                return {
                    status: "error",
                    error: `Engine '${input.engine}' does not support custom rules or is not yet implemented.`
                };
            }

            const normalizedLanguage = input.language.toLowerCase();
            const supportedLanguages = ['apex'];
            if (!supportedLanguages.includes(normalizedLanguage)) {
                return {
                    status: "error",
                    error: `Language '${input.language}' support is not yet added for the Create Custom Rule MCP tool. Currently supported languages: ${supportedLanguages.join(', ')}.`
                };
            }
            const knowledgeBase = await this.buildPMDKnowledgeBase(normalizedLanguage);

            return {
                status: "ready_for_xpath_generation",
                knowledgeBase,
                instructionsForLlm: this.getInstructionsForLlm(knowledgeBase),
                nextStep: {
                    action: "Generate XPath rule configuration using the knowledge base",
                    then: "Call apply_code_analyzer_custom_rule(rule_config_json, project_root)"
                }
            };

        } catch (e: unknown) {
            return {
                status: "error",
                error: `Failed to prepare context: ${getErrorMessage(e)}`
            };
        }
    }

    private engineSupportsCustomRules(engine: string): boolean {
        const supportedEngines: SupportedEngine[] = ['pmd'];
        return supportedEngines.includes(engine as SupportedEngine);
    }

    private async buildPMDKnowledgeBase(language: string): Promise<KnowledgeBase> {
        const astReferenceFile = `${language}-ast-reference.json`;

        const astReference = this.loadKnowledgeBase('pmd', astReferenceFile);
        const xpathFunctionsData = this.loadKnowledgeBase('pmd', 'xpath-functions.json');

        const nodeIndex = astReference.nodes.map((n: any) => n.name);
        const nodeInfo: Record<string, any> = {};

        for (const node of astReference.nodes) {
            nodeInfo[node.name] = {
                name: node.name,
                description: node.description || "",
                category: node.category,
                attributes: node.attributes || []
            };
        }

        // For Apex, only universal PMD functions are available (not Java-specific ones)
        const xpathFunctions = [];
        const universalFunctions = xpathFunctionsData.pmd_extensions?.universal?.functions || [];
        for (const func of universalFunctions) {
            xpathFunctions.push({
                name: func.name,
                syntax: func.syntax,
                desc: func.description,
                returnType: func.returnType,
                example: func.example
            });
        }

        const importantNotes = (language === 'apex' && astReference.important_notes) 
            ? astReference.important_notes 
            : [];

        return {
            nodeIndex,
            nodeInfo,
            xpathFunctions,
            importantNotes
        };
    }

    private loadKnowledgeBase(engine: SupportedEngine, fileName: string): any {
        const filePath = path.join(this.knowledgeBasePath, engine, fileName);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Knowledge base file not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }

    private getInstructionsForLlm(knowledgeBase: KnowledgeBase): string {
        return `

YOUR TASK:
Generate PMD XPath rule configuration(s) based on the user prompt and knowledge base.

OPTIMIZED KNOWLEDGE BASE STRUCTURE:
- nodeIndex: ALL available nodes (use these names)
- nodeInfo: Detailed info for frequently used nodes
- xpathFunctions: PMD-specific XPath extension functions (pmd:* namespace)
- importantNotes: Refer to knowledgeBase.importantNotes for critical notes about common pitfalls and correct attribute usage

XPATH FUNCTIONS:
- PMD uses standard W3C XPath 3.1 functions (you already know these: ends-with, starts-with, contains, matches, not, and, or, string-length, etc.)
- PMD-specific extension functions are provided in xpathFunctions (pmd:fileName, pmd:startLine, pmd:endLine, etc.)
- Use standard XPath 3.1 functions for common operations
- Use PMD extension functions (pmd:*) when you need PMD-specific capabilities

CRITICAL REQUIREMENTS:
1. Use ONLY node names from nodeIndex (e.g., UserClass, NOT ClassNode)
2. For nodeInfo: use provided attributes
3. READ AND FOLLOW knowledgeBase.importantNotes - they contain critical information about common mistakes

SEVERITY LEVELS:
1 = Critical, 2 = High, 3 = Moderate, 4 = Low, 5 = Info

OUTPUT FORMAT (valid JSON only, no markdown):
{
  "xpath": "//UserClass[not(ends-with(@Image, 'Service'))]",
  "rule_name": "EnforceClassNamingSuffix",
  "message": "Class name must end with 'Service'",
  "severity": 2,
  "description": "Enforces Service suffix for all Apex class names",
}

AFTER GENERATING THE CONFIG:
Call: apply_code_analyzer_custom_rule(rule_config_json, project_root)
`;
    }
}