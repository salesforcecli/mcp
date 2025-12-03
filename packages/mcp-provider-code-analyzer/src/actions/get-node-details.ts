import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {getErrorMessage} from "../utils.js";

export type GetNodeDetailsInput = {
    nodeName: string
}

export type GetNodeDetailsOutput = {
    nodeName?: string
    description?: string
    attributes?: Array<{name: string, type: string, description: string}>
    specialNote?: string
    commonParents?: string[]
    usageTip?: string
    error?: string
    availableNodes?: string[]
    suggestion?: string
}

export interface GetNodeDetailsAction {
    exec(input: GetNodeDetailsInput): Promise<GetNodeDetailsOutput>;
}

export class GetNodeDetailsActionImpl implements GetNodeDetailsAction {
    private readonly knowledgeBasePath: string;

    constructor(knowledgeBasePath?: string) {
        // In ES modules, __dirname is not available, so we use import.meta.url
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        this.knowledgeBasePath = knowledgeBasePath || path.join(currentDir, '../../knowledge-base');
    }

    async exec(input: GetNodeDetailsInput): Promise<GetNodeDetailsOutput> {
        try {
            // Load full PMD Apex AST reference
            const astReference = this.loadKnowledgeBase('pmd', 'apex-ast-reference.json');

            if (!astReference || !astReference.nodes) {
                return {
                    error: "Failed to load PMD AST reference",
                    suggestion: "Ensure knowledge-base/custom-rule-generator/pmd directory exists with apex-ast-reference.json"
                };
            }

            // Find the requested node
            const nodeInfo = astReference.nodes.find((node: any) => node.name === input.nodeName);

            if (!nodeInfo) {
                return {
                    error: `Node '${input.nodeName}' not found in AST reference`,
                    availableNodes: astReference.nodes.map((n: any) => n.name),
                    suggestion: "Check node_index from create_custom_rule() response for available nodes"
                };
            }

            // Return compact but complete node details
            return {
                nodeName: nodeInfo.name,
                description: nodeInfo.description || "",
                attributes: nodeInfo.attributes || [],
                specialNote: nodeInfo.note || undefined,
                commonParents: nodeInfo.commonParents || [],
                usageTip: `Use //${input.nodeName} in XPath to match this node type`
            };

        } catch (e: unknown) {
            return {
                error: `Failed to get node details: ${getErrorMessage(e)}`
            };
        }
    }

    private loadKnowledgeBase(engine: string, fileName: string): any {
        const filePath = path.join(this.knowledgeBasePath, 'custom-rule-generator', engine, fileName);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`Knowledge base file not found: ${filePath}`);
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
    }
}

