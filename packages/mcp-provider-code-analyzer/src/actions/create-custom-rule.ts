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
    availableNodes: string[]; // Just node names for token efficiency - use get_node_details for full info
    nodeCount: number; // Total number of available nodes
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
                    action: "Call get_node_details(array of node_name) with the list of selected node names you need to build the XPath",
                    then: "Generate XPath rule configuration using the node details and knowledge base, then call apply_code_analyzer_custom_rule(rule_config_json, project_root)"
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

        // Return only node names (not descriptions) for token efficiency
        // Descriptions and full details available via get_node_details tool
        const availableNodes = Object.values(astReference.nodes).map((n: any) => n.name);
        const nodeCount = availableNodes.length;

        return {
            availableNodes,
            nodeCount
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
        return `Generate PMD XPath rule configuration(s) based on the user prompt.

WORKFLOW:
1. Review availableNodes (${knowledgeBase.nodeCount} nodes) to identify needed nodes
2. Call get_node_details([node_names]) to get attributes, category, and important notes
3. Build XPath using node details and standard XPath 3.1 functions (ends-with, starts-with, contains, matches, not, and, or, etc.)

REQUIREMENTS:
- Use ONLY node names from availableNodes 
- ALWAYS call get_node_details first - it provides attributes and critical notes
- Severity: 1=Critical, 2=High, 3=Moderate, 4=Low, 5=Info

OUTPUT (JSON only):
{"xpath": "//UserClass[not(ends-with(@Image, 'Service'))]", "rule_name": "EnforceClassNamingSuffix", "message": "Class name must end with 'Service'", "severity": 2, "description": "Enforces Service suffix"}

Then call: apply_code_analyzer_custom_rule(rule_config_json, project_root)`;
    }
}