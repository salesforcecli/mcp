import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getErrorMessage } from "../utils.js";

export type SupportedEngine = 'pmd' | 'eslint' | 'regex';

export type CreateCustomRuleInput = {
    engine: SupportedEngine  // Required: Which engine to create the rule for
    language: string  // Required: The target language for the custom rule
}

export type CreateCustomRuleOutput = {
    status: string
    knowledgeBase?: KnowledgeBase
    instructionsForLlm?: string
    nextStep?: {
        action: string
        optional?: string
        then: string
    }
    error?: string
}

export type KnowledgeBase = {
    nodeIndex: string[]
    nodeInfo: Record<string, {
        description: string
        category?: string
        attributes: Array<{ name: string, type: string, description: string }>
        note?: string
    }>
    xpathFunctions: Array<{ name: string, syntax: string, desc: string, returnType?: string, example?: string }>
    importantNotes?: Array<{ title: string, content: string }>
}

export interface CreateCustomRuleAction {
    exec(input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput>;
}

export class CreateCustomRuleActionImpl implements CreateCustomRuleAction {
    private readonly knowledgeBasePath: string;

    constructor(knowledgeBasePath?: string) {
        // Resources are copied to dist/resources during build, maintaining the same structure as src
        // Since dist mirrors src structure, we can use a simple relative path
        if (knowledgeBasePath) {
            this.knowledgeBasePath = knowledgeBasePath;
        } else {
            // From dist/actions/ -> ../resources/custom-rules = dist/resources/custom-rules
            const currentDir = path.dirname(fileURLToPath(import.meta.url));
            this.knowledgeBasePath = path.resolve(currentDir, '..', 'resources', 'custom-rules');
        }
    }

    async exec(input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput> {
        try {
            // Step 1: Validate engine
            if (!this.engineSupportsCustomRules(input.engine)) {
                return {
                    status: "error",
                    error: `Engine '${input.engine}' does not support custom rules or is not yet implemented.`
                };
            }

            const normalizedLanguage = input.language.toLowerCase();

            // Step 2: Decide which knowledge base approach to use based on engine
            let knowledgeBase: KnowledgeBase;

            // Different engines have different knowledge base structures
            if (input.engine === 'pmd') {
                const supportedLanguages = ['apex'];
                if (!supportedLanguages.includes(normalizedLanguage)) {
                    return {
                        status: "error",
                        error: `Language '${input.language}' support is not yet added for the Create Custom Rule MCP tool. Currently supported languages: ${supportedLanguages.join(', ')}.`
                    };
                }
                // Load static PMD AST reference documentation
                knowledgeBase = await this.buildPMDKnowledgeBase(normalizedLanguage);
            } else {
                return {
                    status: "error",
                    error: `Unsupported engine: ${input.engine}`
                };
            }

            // Return instructions for LLM
            return {
                status: "ready_for_xpath_generation",
                knowledgeBase,
                instructionsForLlm: this.getInstructionsForLlm(input.engine, normalizedLanguage),
                nextStep: {
                    action: "Generate XPath rule configuration using the knowledge base",
                    optional: "Call get_node_details(node_name) if you need details for nodes not in common_nodes",
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
        // Use the provided language (normalized to lowercase)
        const normalizedLanguage = language.toLowerCase();

        // Determine which AST reference file to load
        const astReferenceFile = `${normalizedLanguage}-ast-reference.json`;

        // Load AST reference and XPath functions
        const astReference = this.loadKnowledgeBase('pmd', astReferenceFile);

        const xpathFunctionsData = this.loadKnowledgeBase('pmd', 'xpath-functions.json');

        // Extract node index
        const nodeIndex = astReference.nodes.map((n: any) => n.name);

        // Extract common nodes with full details
        const nodeInfo: Record<string, any> = {};

        // Only Apex has a large AST reference file that needs optimization
        // For HTML, XML, and other languages, include ALL nodes
        for (const node of astReference.nodes) {
            nodeInfo[node.name] = {
                name: node.name,
                description: node.description || "",
                category: node.category,
                attributes: node.attributes || []
            };
        }

        // Extract PMD-specific XPath extension functions
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

        // Extract important notes only for Apex language
        const importantNotes = (normalizedLanguage === 'apex' && astReference.important_notes) 
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

    private getInstructionsForLlm(engine: SupportedEngine, language: string): string {
        // Load important notes from AST reference only for PMD + Apex
        let importantNotesSection = '';
        if (engine === 'pmd' && language.toLowerCase() === 'apex') {
            try {
                const astReference = this.loadKnowledgeBase('pmd', 'apex-ast-reference.json');
                if (astReference.important_notes && astReference.important_notes.length > 0) {
                    importantNotesSection = '\nIMPORTANT NOTES (Critical for correct XPath generation):\n';
                    for (const note of astReference.important_notes) {
                        importantNotesSection += `- ${note.title}: ${note.content}\n`;
                    }
                }
            } catch (e) {
                // If notes can't be loaded, continue without them
            }
        }

        return `

YOUR TASK:
Generate PMD XPath rule configuration(s) based on the user prompt and knowledge base.

OPTIMIZED KNOWLEDGE BASE STRUCTURE:
- nodeIndex: ALL available nodes (use these names)
- nodeInfo: Detailed info for frequently used nodes
- xpathFunctions: PMD-specific XPath extension functions (pmd:* namespace)
- importantNotes: Critical notes about common pitfalls and correct attribute usage${importantNotesSection}

XPATH FUNCTIONS:
- PMD uses standard W3C XPath 3.1 functions (you already know these: ends-with, starts-with, contains, matches, not, and, or, string-length, etc.)
- PMD-specific extension functions are provided in xpathFunctions (pmd:fileName, pmd:startLine, pmd:endLine, etc.)
- Use standard XPath 3.1 functions for common operations
- Use PMD extension functions (pmd:*) when you need PMD-specific capabilities

CRITICAL REQUIREMENTS:
1. Use ONLY node names from nodeIndex (e.g., UserClass, NOT ClassNode)
2. For nodeInfo: use provided attributes
3. READ AND FOLLOW the importantNotes above - they contain critical information about common mistakes

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