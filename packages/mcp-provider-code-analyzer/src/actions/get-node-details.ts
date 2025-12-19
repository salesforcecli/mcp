import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getErrorMessage } from "../utils.js";

type SupportedEngine = 'pmd' | 'eslint' | 'regex';

export type GetNodeDetailsInput = {
    engine: SupportedEngine;
    language: string;
    nodeNames: string[];
};

type AstNodeAttribute = {
    name: string;
    type: string;
    description: string;
};

type AstNode = {
    name: string;
    description?: string;
    category?: string;
    extends?: string;
    implements?: string[];
    inherits?: string[];
    attributes?: AstNodeAttribute[];
};

type InheritSchemaAttribute = {
    name: string;
    type: string;
};

type XPathPattern = {
    rule_name: string;
    description: string;
    message: string;
    xpath: string;
};

type XPathPatternCatalog = {
    description?: string;
    patterns?: XPathPattern[];
};

type AstReference = {
    nodes: Record<string, AstNode>;
    inheritSchema?: Record<string, InheritSchemaAttribute[]>;
    important_notes?: Array<{ title: string; content: string }>;
    xpath_pattern_catalog?: XPathPatternCatalog;
};

type NodeDetail = {
    name: string;
    description: string;
    category?: string;
    extends?: string;
    implements?: string[];
    inherits?: string[];
    attributes: Array<{
        name: string;
        type: string;
        description: string;
    }>;
    xpathExamples?: Array<{
        rule_name: string;
        xpath: string;
        description: string;
    }>;
};

export type GetNodeDetailsOutput = {
    status: string;
    nodeDetails?: NodeDetail[];
    importantNotes?: Array<{ title: string; content: string }>;
    error?: string;
};

export interface GetNodeDetailsAction {
    exec(input: GetNodeDetailsInput): Promise<GetNodeDetailsOutput>;
}

export class GetNodeDetailsActionImpl implements GetNodeDetailsAction {
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
     * Executes the get node details action by validating engine/language support and retrieving node information.
     * 
     * This is the main entry point that:
     * 1. Validates that the engine supports node details
     * 2. Validates that the language is supported
     * 3. Validates that at least one node name is provided
     * 4. Loads the knowledge base for the specified language
     * 5. Retrieves detailed information for requested nodes including direct and inherited attributes
     * 6. Retrieves important notes for the language
     * 
     * @param input - The input containing engine, language, and array of node names to get details for
     * @returns A GetNodeDetailsOutput with node details (including parent classes as separate entries)
     *          and important notes, or an error status
     *          Status will be "success" on success, "error" on failure
     */
    async exec(input: GetNodeDetailsInput): Promise<GetNodeDetailsOutput> {
        try {
            if (!this.engineSupportsNodeDetails(input.engine)) {
                return {
                    status: "error",
                    error: `Engine '${input.engine}' does not support node details or is not yet implemented.`
                };
            }

            const normalizedLanguage = input.language.toLowerCase();
            const supportedLanguages = ['apex'];
            if (!supportedLanguages.includes(normalizedLanguage)) {
                return {
                    status: "error",
                    error: `Language '${input.language}' support is not yet added for getting node details. Currently supported languages: ${supportedLanguages.join(', ')}.`
                };
            }

            if (!input.nodeNames || input.nodeNames.length === 0) {
                return {
                    status: "error",
                    error: "At least one node name is required."
                };
            }

            // Load knowledge base once and reuse for both node details and important notes
            const astReferenceFile = `${normalizedLanguage}-ast-reference.json`;
            const astReference = this.loadKnowledgeBase('pmd', astReferenceFile);

            const nodeDetails = this.getNodeDetails(astReference, input.nodeNames);
            const importantNotes = this.getImportantNotes(astReference, normalizedLanguage);

            // Add XPath examples from pattern catalog
            const nodeDetailsWithExamples = this.addXPathExamples(nodeDetails, astReference);

            return {
                status: "success",
                nodeDetails: nodeDetailsWithExamples,
                importantNotes
            };

        } catch (e: unknown) {
            return {
                status: "error",
                error: `Failed to get node details: ${getErrorMessage(e)}`
            };
        }
    }

    /**
     * Checks whether the specified engine supports retrieving node details.
     * 
     * Currently only PMD engine is supported. ESLint and regex engines are not yet implemented.
     * 
     * @param engine - The engine name to check (e.g., 'pmd', 'eslint', 'regex')
     * @returns true if the engine supports node details, false otherwise
     */
    private engineSupportsNodeDetails(engine: string): boolean {
        const supportedEngines: SupportedEngine[] = ['pmd'];
        return supportedEngines.includes(engine as SupportedEngine);
    }

    /**
     * Retrieves detailed information for the requested AST nodes, including direct attributes
     * and inherited attributes from parent classes.
     * 
     * For each requested node:
     * 1. Returns the node with its direct attributes only
     * 2. If the node has parent classes (via `inherits`), adds each parent class as a separate
     *    entry with all its attributes from the inheritSchema
     * 3. Uses a Set to track processed parent classes to avoid duplicates when multiple
     *    requested nodes share the same parent
     * 4. If a requested node is not found, includes it in the result with an error description
     * 
     * This approach allows XPath rule builders to see both direct attributes and all available
     * inherited attributes, which is essential for building correct XPath expressions.
     * 
     * @param astReference - The loaded AST reference containing nodes and inheritance schema
     * @param nodeNames - Array of node names to get details for
     * @returns Array of NodeDetail objects including requested nodes and their parent classes
     *          as separate entries. Missing nodes are included with error descriptions.
     */
    private getNodeDetails(astReference: AstReference, nodeNames: string[]): NodeDetail[] {
        const nodeDetails: NodeDetail[] = [];
        const inheritSchema = astReference.inheritSchema || {};
        const processedParentClasses = new Set<string>();

        // Get details for requested nodes (nodes is now a key-value object)
        for (const nodeName of nodeNames) {
            const node = astReference.nodes[nodeName];
            if (node) {
                // Get only direct attributes for the requested node
                const directAttributes = (node.attributes || []).map((attr: AstNodeAttribute) => ({
                    name: attr.name,
                    type: attr.type,
                    description: attr.description
                }));

                nodeDetails.push({
                    name: node.name,
                    description: node.description || "",
                    category: node.category,
                    extends: node.extends,
                    implements: node.implements,
                    attributes: directAttributes,
                    inherits: node.inherits
                });

                // Add parent classes as separate node entries
                const parentClasses = node.inherits || [];
                for (const parentClass of parentClasses) {
                    if (!processedParentClasses.has(parentClass)) {
                        processedParentClasses.add(parentClass);
                        const parentAttributes = inheritSchema[parentClass] || [];
                        
                        nodeDetails.push({
                            name: parentClass,
                            description: `Parent class that provides inherited attributes to child nodes`,
                            category: "Inheritance",
                            attributes: parentAttributes.map((attr: InheritSchemaAttribute) => ({
                                name: attr.name,
                                type: attr.type,
                                description: `Attribute from ${parentClass}`
                            }))
                        });
                    }
                }
            } else {
                // Include error info for nodes not found
                nodeDetails.push({
                    name: nodeName,
                    description: `Node '${nodeName}' not found in AST reference`,
                    attributes: []
                });
            }
        }

        return nodeDetails;
    }


    /**
     * Adds XPath pattern examples to node details by finding patterns that use the requested nodes.
     * 
     * For each node in nodeDetails, searches the xpath_pattern_catalog for patterns that
     * reference that node in their XPath expression. This helps LLMs see real-world examples
     * of how nodes are used in XPath rules.
     * 
     * @param nodeDetails - Array of node details to enhance with examples
     * @param astReference - The AST reference containing xpath_pattern_catalog
     * @returns Array of node details with xpathExamples added
     */
    private addXPathExamples(nodeDetails: NodeDetail[], astReference: AstReference): NodeDetail[] {
        const catalog = astReference.xpath_pattern_catalog;
        const patterns = catalog?.patterns;
        if (!patterns || patterns.length === 0) {
            return nodeDetails;
        }

        return nodeDetails.map(nodeDetail => {
            // Skip parent classes and error nodes
            if (nodeDetail.category === "Inheritance" || nodeDetail.description.includes("not found")) {
                return nodeDetail;
            }

            const nodeName = nodeDetail.name;
            const examples: Array<{ rule_name: string; xpath: string; description: string }> = [];

            // Find patterns that use this node
            for (const pattern of patterns) {
                if (!pattern.xpath) continue;

                // Check if XPath contains this node (e.g., //MethodCallExpression, //Method, etc.)
                // Match patterns like //NodeName or //NodeName[ or //NodeName/ or //NodeName]
                const nodePattern = new RegExp(`//${nodeName}(?:\\[|/|\\s|$|\\|)`, 'i');
                if (nodePattern.test(pattern.xpath)) {
                    examples.push({
                        rule_name: pattern.rule_name,
                        xpath: pattern.xpath,
                        description: pattern.description || pattern.message
                    });
                }
            }

            // Limit to top 5 examples to keep response size manageable
            if (examples.length > 0) {
                return {
                    ...nodeDetail,
                    xpathExamples: examples.slice(0, 5)
                };
            }

            return nodeDetail;
        });
    }

    /**
     * Retrieves important notes for the specified language from the AST reference.
     * 
     * Important notes contain critical information about common pitfalls and correct
     * attribute usage for XPath generation. Currently only available for Apex language.
     * 
     * @param astReference - The loaded AST reference that may contain important_notes
     * @param language - The target language (should be normalized to lowercase)
     * @returns Array of important notes with title and content, or empty array if not available
     *          for the specified language
     */
    private getImportantNotes(astReference: AstReference, language: string): Array<{ title: string; content: string }> {
        return (language === 'apex' && astReference.important_notes) 
            ? astReference.important_notes 
            : [];
    }

    /**
     * Loads and parses a knowledge base JSON file for the specified engine and file name.
     * 
     * Constructs the file path by joining the knowledge base directory, engine subdirectory,
     * and file name. Reads the file synchronously and parses it as JSON, casting it to
     * AstReference type.
     * 
     * @param engine - The engine name (e.g., 'pmd', 'eslint', 'regex')
     * @param fileName - The name of the knowledge base file to load (e.g., 'apex-ast-reference.json')
     * @returns The parsed JSON content as an AstReference object
     * @throws Error if the file doesn't exist, cannot be read, or contains invalid JSON
     */
    private loadKnowledgeBase(engine: SupportedEngine, fileName: string): AstReference {
        const filePath = path.join(this.knowledgeBasePath, engine, fileName);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Knowledge base file not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as AstReference;
    }
}

