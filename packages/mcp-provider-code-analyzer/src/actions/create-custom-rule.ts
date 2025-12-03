import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JavaCommandExecutor } from "@salesforce/code-analyzer-engine-api/utils";
import { LogLevel } from "@salesforce/code-analyzer-engine-api";
import { getErrorMessage } from "../utils.js";
import { getMessage } from "../messages.js";
import os from "node:os";

export type SupportedEngine = 'pmd' | 'eslint' | 'regex';

export type CreateCustomRuleInput = {
    userPrompt: string
    engine: SupportedEngine  // Required: Which engine to create the rule for
    currentDirectory?: string
}

export type CreateCustomRuleOutput = {
    status: string
    projectRoot?: string
    userPrompt?: string
    knowledgeBase?: OptimizedKnowledgeBase
    instructionsForLlm?: string
    nextStep?: {
        action: string
        optional?: string
        then: string
    }
    workflowSteps?: Array<{ step: number, action: string, status: string, [key: string]: any }>
    error?: string
}

export type OptimizedKnowledgeBase = {
    nodeIndex: string[]
    commonNodes: Record<string, {
        description: string
        attributes: Array<{ name: string, type: string, description: string }>
        note?: string
    }>
    xpathFunctions: Array<{ name: string, syntax: string, desc: string }>
    fallbackInfo: {
        toolName: string
        usage: string
        example: string
    }
}

export interface CreateCustomRuleAction {
    exec(input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput>;
}

export class CreateCustomRuleActionImpl implements CreateCustomRuleAction {
    private readonly knowledgeBasePath: string;

    constructor(knowledgeBasePath?: string) {
        // Default to package's knowledge-base directory
        // In ES modules, __dirname is not available, so we use import.meta.url
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        this.knowledgeBasePath = knowledgeBasePath || path.join(currentDir, '../../knowledge-base');
    }

    async exec(input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput> {
        try {
            const steps: Array<{ step: number, action: string, status: string, [key: string]: any }> = [];

            // Step 0: Validate engine supports custom rules
            if (!this.engineSupportsCustomRules(input.engine)) {
                return {
                    status: "error",
                    error: `Engine '${input.engine}' does not support custom rules or is not yet implemented.`,
                    workflowSteps: [{
                        step: 0,
                        action: "Validate engine",
                        status: "failed",
                        engine: input.engine,
                        supportedEngines: ['pmd', 'eslint', 'regex']
                    }]
                };
            }

            steps.push({
                step: 0,
                action: "Validate engine supports custom rules",
                status: "success",
                engine: input.engine
            });

            // Step 1: Find SFDX project root
            const currentDir = input.currentDirectory || process.cwd();
            const projectRoot = this.findSfdxProjectRoot(currentDir);

            if (!projectRoot) {
                return {
                    status: "error",
                    error: "Not in an SFDX project. Please run from within an SFDX project directory.",
                    workflowSteps: [{
                        step: 1,
                        action: "Find SFDX project root",
                        status: "failed",
                        currentDirectory: currentDir,
                        suggestion: "Navigate to a directory containing sfdx-project.json"
                    }]
                };
            }

            steps.push({
                step: 1,
                action: "Find SFDX project root",
                status: "success",
                projectRoot
            });

            // Step 2: Decide which knowledge base approach to use based on engine
            let knowledgeBase: OptimizedKnowledgeBase;
            let useCase: string;

            // Different engines have different knowledge base structures
            if (input.engine === 'pmd') {
                // if (input.sampleFiles && input.sampleFiles.length > 0) {
                //     // Use Case 1: Parse sample Apex files and extract AST patterns
                //     useCase = "dynamic_ast_extraction";
                //     knowledgeBase = await this.buildDynamicKnowledgeBase(input.sampleFiles);

                //     steps.push({
                //         step: 2,
                //         action: "Parse sample Apex files and extract AST patterns",
                //         status: "success",
                //         useCase,
                //         engine: input.engine,
                //         filesProcessed: input.sampleFiles.length,
                //         nodesDiscovered: (knowledgeBase as DynamicKnowledgeBase).nodesFound.length
                //     });
                // }
                // Use Case 2: Load static PMD AST reference documentation
                useCase = "static_ast_reference";
                const detectedLanguage = this.detectLanguageFromPrompt(input.userPrompt);
                knowledgeBase = await this.buildOptimizedKnowledgeBase(input.userPrompt);

                const isOptimized = detectedLanguage === 'apex';
                steps.push({
                    step: 2,
                    action: `Load PMD XPath knowledge base for ${detectedLanguage.toUpperCase()}`,
                    status: "success",
                    useCase,
                    engine: input.engine,
                    detectedLanguage,
                    optimization: isOptimized ? {
                        totalNodesAvailable: knowledgeBase.nodeIndex.length,
                        commonNodesDetailed: Object.keys(knowledgeBase.commonNodes).length,
                        xpathFunctions: knowledgeBase.xpathFunctions.length,
                        tokenReduction: "~70% (optimized for cost efficiency - Apex only)"
                    } : {
                        totalNodesAvailable: knowledgeBase.nodeIndex.length,
                        allNodesIncluded: Object.keys(knowledgeBase.commonNodes).length,
                        xpathFunctions: knowledgeBase.xpathFunctions.length,
                        note: "All nodes included (small AST reference)"
                    }
                });
            } else if (input.engine === 'eslint') {
                // ESLint: Load ESLint rule template and documentation
                useCase = "eslint_rule_template";
                knowledgeBase = await this.buildEslintKnowledgeBase();

                steps.push({
                    step: 2,
                    action: "Load ESLint rule template and documentation",
                    status: "success",
                    useCase,
                    engine: input.engine
                });
            } else if (input.engine === 'regex') {
                // Regex: Load regex pattern examples and documentation
                useCase = "regex_pattern_template";
                knowledgeBase = await this.buildRegexKnowledgeBase();

                steps.push({
                    step: 2,
                    action: "Load Regex pattern template and documentation",
                    status: "success",
                    useCase,
                    engine: input.engine
                });
            } else {
                return {
                    status: "error",
                    error: `Unsupported engine: ${input.engine}`,
                    workflowSteps: steps
                };
            }

            // Return instructions for LLM
            return {
                status: "ready_for_xpath_generation",
                projectRoot,
                userPrompt: input.userPrompt,
                knowledgeBase,
                instructionsForLlm: this.getInstructionsForLlm(useCase),
                nextStep: {
                    action: "Generate XPath rule configuration using the knowledge base",
                    optional: "Call get_node_details(node_name) if you need details for nodes not in common_nodes",
                    then: "Call apply_custom_rule(rule_config_json, project_root)"
                },
                workflowSteps: steps
            };

        } catch (e: unknown) {
            return {
                status: "error",
                error: `Failed to prepare context: ${getErrorMessage(e)}`,
                userPrompt: input.userPrompt
            };
        }
    }

    private engineSupportsCustomRules(engine: string): boolean {
        const supportedEngines: SupportedEngine[] = ['pmd', 'eslint', 'regex'];
        return supportedEngines.includes(engine as SupportedEngine);
    }

    private findSfdxProjectRoot(startDir: string): string | null {
        let currentDir = path.resolve(startDir);
        const root = path.parse(currentDir).root;

        while (currentDir !== root) {
            const sfdxProjectPath = path.join(currentDir, 'sfdx-project.json');
            if (fs.existsSync(sfdxProjectPath)) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
        return null;
    }

    private traverseAst(
        node: any,
        fileName: string,
        nodeExamples: Record<string, any>,
        nodesFound: Set<string>,
        depth: number = 0
    ): void {
        if (!node || typeof node !== 'object') return;

        const nodeType = node.nodeType || node.xPathNodeName;
        if (nodeType) {
            nodesFound.add(nodeType);

            // Initialize tracking for this node type
            if (!nodeExamples[nodeType]) {
                nodeExamples[nodeType] = {
                    nodeType,
                    examples: [],
                    attributes: new Set<string>(),
                    commonPatterns: []
                };
            }

            // Collect attributes
            for (const key of Object.keys(node)) {
                if (key !== 'children' && key !== 'nodeType' && key !== 'xPathNodeName' && key !== 'childCount') {
                    nodeExamples[nodeType].attributes.add(key);
                }
            }

            // Store example (limit to first 3 examples per node type to save tokens)
            if (nodeExamples[nodeType].examples.length < 3) {
                nodeExamples[nodeType].examples.push({
                    file: fileName,
                    location: node.location || { beginLine: 0, endLine: 0 },
                    context: `Found in ${path.basename(fileName)}`,
                    astSnippet: this.simplifyAstSnippet(node)
                });
            }
        }

        // Traverse children
        if (node.children && Array.isArray(node.children)) {
            for (const child of node.children) {
                this.traverseAst(child, fileName, nodeExamples, nodesFound, depth + 1);
            }
        }
    }

    private simplifyAstSnippet(node: any): any {
        // Return a simplified version of the node (max 2 levels deep to save tokens)
        const simplified: any = {
            nodeType: node.nodeType || node.xPathNodeName
        };

        for (const key of Object.keys(node)) {
            if (key !== 'children' && key !== 'childCount' && node[key] !== undefined && node[key] !== null) {
                simplified[key] = node[key];
            }
        }

        // Include first-level children types only
        if (node.children && Array.isArray(node.children) && node.children.length > 0) {
            simplified.childTypes = node.children
                .map((c: any) => c.nodeType || c.xPathNodeName)
                .filter((t: string) => t);
        }

        return simplified;
    }

    /**
     * Detect the target language from user prompt for PMD rules
     * PMD supports multiple languages: Apex, HTML, XML, Visualforce, etc.
     */
    private detectLanguageFromPrompt(userPrompt: string): 'apex' | 'html' | 'xml' | 'visualforce' {
        const prompt = userPrompt.toLowerCase();

        // HTML detection
        if (prompt.includes('html') ||
            prompt.includes('<') && (prompt.includes('tag') || prompt.includes('element')) ||
            prompt.includes('lightning web component') ||
            prompt.includes('lwc') ||
            prompt.includes('aura component')) {
            return 'html';
        }

        // XML detection
        if (prompt.includes('xml') ||
            prompt.includes('metadata') ||
            prompt.includes('.xml')) {
            return 'xml';
        }

        // Visualforce detection
        if (prompt.includes('visualforce') ||
            prompt.includes('vf page') ||
            prompt.includes('apex:')) {
            return 'visualforce';
        }

        // Default to Apex for PMD
        return 'apex';
    }

    private async buildOptimizedKnowledgeBase(userPrompt: string): Promise<OptimizedKnowledgeBase> {
        // Detect the language from user prompt
        const language = this.detectLanguageFromPrompt(userPrompt);

        // Determine which AST reference file to load
        const astReferenceFile = language === 'apex' ? 'apex-ast-reference.json' :
            language === 'html' ? 'html-ast-reference.json' :
                language === 'xml' ? 'xml-ast-reference.json' :
                    'apex-ast-reference.json'; // fallback

        // Load AST reference and XPath functions
        const astReference = this.loadKnowledgeBase('pmd', astReferenceFile);
        const xpathFunctionsData = this.loadKnowledgeBase('pmd', 'xpath-functions.json');

        // Extract node index
        const nodeIndex = astReference.nodes.map((n: any) => n.name);

        // Extract common nodes with full details
        const commonNodes: Record<string, any> = {};

        // Only Apex has a large AST reference file that needs optimization
        // For HTML, XML, and other languages, include ALL nodes
        if (language === 'apex') {
            // Apex optimization: Only include most common nodes to reduce tokens
            const ALWAYS_INCLUDE_NODES = [
                'MethodCallExpression',
                'Method',
                'UserClass',
                'Annotation'
            ];

            for (const node of astReference.nodes) {
                if (ALWAYS_INCLUDE_NODES.includes(node.name)) {
                    commonNodes[node.name] = {
                        description: node.description || "",
                        attributes: node.attributes || [],
                        note: node.note || ""
                    };
                }
            }
        } else {
            // For HTML, XML, and other languages: Include ALL nodes (small AST files)
            for (const node of astReference.nodes) {
                commonNodes[node.name] = {
                    description: node.description || "",
                    attributes: node.attributes || [],
                    note: node.note || "",
                    xpath_name: node.xpath_name || node.name,
                    common_use_cases: node.common_use_cases || [],
                    example_xpath: node.example_xpath || []
                };
            }
        }

        // Compact XPath functions
        const xpathFunctions = [];
        const essentialFunctions = ['ends-with', 'starts-with', 'contains', 'matches', 'not', 'and', 'or', 'string-length'];
        for (const func of xpathFunctionsData.functions || []) {
            if (essentialFunctions.includes(func.name)) {
                xpathFunctions.push({
                    name: func.name,
                    syntax: func.syntax,
                    desc: func.description
                });
            }
        }

        return {
            nodeIndex,
            commonNodes,
            xpathFunctions,
            fallbackInfo: language === 'apex' ? {
                toolName: "get_node_details",
                usage: "If you need detailed information about a node not in common_nodes, call get_node_details(node_name)",
                example: "get_node_details('VariableDeclaration') returns full attribute details"
            } : {
                toolName: "none",
                usage: "All nodes are already included in commonNodes",
                example: "No need to call get_node_details - all information is available"
            }
        };
    }

    private loadKnowledgeBase(engine: SupportedEngine, fileName: string): any {
        const filePath = path.join(this.knowledgeBasePath, 'custom-rule-generator', engine, fileName);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Knowledge base file not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }

    private loadXPathFunctions(): Array<{ name: string, syntax: string, desc: string }> {
        try {
            const data = this.loadKnowledgeBase('pmd', 'xpath-functions.json');
            const essentialFunctions = ['ends-with', 'starts-with', 'contains', 'matches', 'not', 'and', 'or', 'string-length'];

            return (data.functions || [])
                .filter((f: any) => essentialFunctions.includes(f.name))
                .map((f: any) => ({
                    name: f.name,
                    syntax: f.syntax,
                    desc: f.description
                }));
        } catch {
            return [];
        }
    }

    private async buildEslintKnowledgeBase(): Promise<any> {
        // TODO: Implement ESLint knowledge base
        // ESLint custom rules are JavaScript/TypeScript files that export a rule object
        return {
            ruleFormat: "eslint",
            template: "ESLint rules are created as JavaScript/TypeScript modules",
            documentation: "https://eslint.org/docs/latest/extend/custom-rules",
            exampleStructure: {
                meta: {
                    type: "problem",
                    docs: {
                        description: "Rule description",
                        category: "Best Practices"
                    }
                },
                create: "function(context) { return { /* visitor methods */ }; }"
            },
            instructions: "ESLint rules use AST visitor pattern. Implement create() function that returns visitor methods for AST nodes."
        };
    }

    private async buildRegexKnowledgeBase(): Promise<any> {
        // TODO: Implement Regex knowledge base
        // Regex rules are pattern-based rules defined in YAML
        return {
            ruleFormat: "regex",
            documentation: "Regex rules match file content patterns",
            exampleStructure: {
                name: "RuleName",
                pattern: "regex pattern",
                message: "Violation message",
                severity: 2,
                files: ["*.cls", "*.trigger"]
            },
            instructions: "Regex rules are defined in code-analyzer.yml under engines.regex.custom_rules"
        };
    }

    private getInstructionsForLlm(useCase: string): string {

        return `
╔══════════════════════════════════════════════════════════════════════╗
║       XPATH RULE GENERATION - STATIC REFERENCE MODE                  ║
╚══════════════════════════════════════════════════════════════════════╝

YOUR TASK:
Generate PMD XPath rule configuration(s) based on the user prompt and knowledge base.

OPTIMIZED KNOWLEDGE BASE STRUCTURE:
- nodeIndex: ALL available nodes (use these names)
- commonNodes: Detailed info for frequently used nodes
- xpathFunctions: Common XPath functions
- fallbackInfo: How to get details for other nodes

IF YOU NEED MORE NODE DETAILS:
1. Check if the node exists in nodeIndex
2. If node is not in commonNodes, call: get_node_details(node_name)
3. Use the returned attributes to build accurate XPath

CRITICAL REQUIREMENTS:
1. Use ONLY node names from nodeIndex (e.g., UserClass, NOT ClassNode)
2. For commonNodes: use provided attributes
3. For other nodes: call get_node_details() to get attributes

SEVERITY LEVELS:
1 = Critical, 2 = High, 3 = Moderate, 4 = Low, 5 = Info

OUTPUT FORMAT (valid JSON only, no markdown):
{
  "xpath": "//UserClass[not(ends-with(@Image, 'Service'))]",
  "rule_name": "EnforceClassNamingSuffix",
  "message": "Class name must end with 'Service'",
  "severity": 2,
  "tags": ["BestPractices", "Naming", "Apex"],
  "description": "Enforces Service suffix for all Apex class names",
  "explanation": "Uses UserClass node with @Image attribute."
}

AFTER GENERATING THE CONFIG:
Call: apply_custom_rule(rule_config_json, project_root)
`;
    }
}