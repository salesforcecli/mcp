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

            const nodeDetails = await this.getNodeDetails(astReference, input.nodeNames);
            const importantNotes = this.getImportantNotes(astReference, normalizedLanguage);

            return {
                status: "success",
                nodeDetails,
                importantNotes
            };

        } catch (e: unknown) {
            return {
                status: "error",
                error: `Failed to get node details: ${getErrorMessage(e)}`
            };
        }
    }

    private engineSupportsNodeDetails(engine: string): boolean {
        const supportedEngines: SupportedEngine[] = ['pmd'];
        return supportedEngines.includes(engine as SupportedEngine);
    }

    private async getNodeDetails(astReference: any, nodeNames: string[]): Promise<NodeDetail[]> {
        const nodeDetails: NodeDetail[] = [];
        const inheritSchema = astReference.inheritSchema || {};
        const processedParentClasses = new Set<string>();

        // Get details for requested nodes (nodes is now a key-value object)
        for (const nodeName of nodeNames) {
            const node = astReference.nodes[nodeName];
            if (node) {
                // Get only direct attributes for the requested node
                const directAttributes = (node.attributes || []).map((attr: { name: string; type: string; description: string }) => ({
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
                            attributes: parentAttributes.map((attr: { name: string; type: string }) => ({
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


    private getImportantNotes(astReference: any, language: string): Array<{ title: string; content: string }> {
        return (language === 'apex' && astReference.important_notes) 
            ? astReference.important_notes 
            : [];
    }

    private loadKnowledgeBase(engine: SupportedEngine, fileName: string): any {
        const filePath = path.join(this.knowledgeBasePath, engine, fileName);

        if (!fs.existsSync(filePath)) {
            throw new Error(`Knowledge base file not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
}

