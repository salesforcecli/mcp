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

    /**
     * Executes the custom rule creation action by validating engine/language support and building the knowledge base.
     * 
     * This is the main entry point that:
     * 1. Validates that the engine supports custom rules
     * 2. Validates that the language is supported
     * 3. Loads and builds the knowledge base for the specified language
     * 4. Generates instructions for the LLM to create XPath rules
     * 
     * @param input - The input containing engine and language for rule creation
     * @returns A CreateCustomRuleOutput with knowledge base and instructions, or an error status
     *          Status will be "ready_for_xpath_generation" on success, "error" on failure
     */
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

    /**
     * Checks whether the specified engine supports custom rule creation.
     * 
     * Currently only PMD engine is supported. ESLint and regex engines are not yet implemented.
     * 
     * @param engine - The engine name to check (e.g., 'pmd', 'eslint', 'regex')
     * @returns true if the engine supports custom rules, false otherwise
     */
    private engineSupportsCustomRules(engine: string): boolean {
        const supportedEngines: SupportedEngine[] = ['pmd'];
        return supportedEngines.includes(engine as SupportedEngine);
    }

    /**
     * Builds a knowledge base containing available AST nodes for the given language.
     * 
     * Loads the AST reference JSON file for the specified language and extracts only
     * node names (not full descriptions) for token efficiency. Full node details
     * including attributes, categories, and important notes are available via the
     * get_node_details tool.
     * 
     * @param language - The target language (e.g., 'apex', 'javascript'). Should be normalized to lowercase.
     * @returns A KnowledgeBase object containing an array of available node names and the total count
     * @throws Error if the knowledge base file is missing, invalid JSON, or has an unexpected structure
     */
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

    /**
     * Loads and parses a knowledge base JSON file for the specified engine and file name.
     * 
     * Constructs the file path by joining the knowledge base directory, engine subdirectory,
     * and file name. Reads the file synchronously and parses it as JSON.
     * 
     * @param engine - The engine name (e.g., 'pmd', 'eslint', 'regex')
     * @param fileName - The name of the knowledge base file to load (e.g., 'apex-ast-reference.json')
     * @returns The parsed JSON content as an object
     * @throws Error if the file doesn't exist, cannot be read, or contains invalid JSON
     */
    private loadKnowledgeBase(engine: SupportedEngine, fileName: string): any {
        const filePath = path.join(this.knowledgeBasePath, engine, fileName);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Knowledge base file not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }

    /**
     * Generates instructions for the LLM on how to create PMD XPath rule configurations.
     * 
     * Creates a formatted instruction string that guides the LLM through the workflow
     * of generating custom rules. The instructions include:
     * - Workflow steps (review nodes, get details, build XPath)
     * - Requirements and constraints
     * - Severity level mapping
     * - Example output format
     * - Next steps in the orchestration pattern
     * 
     * @param knowledgeBase - The knowledge base containing available nodes and count
     * @returns A formatted string with instructions for the LLM to generate XPath rules
     */
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