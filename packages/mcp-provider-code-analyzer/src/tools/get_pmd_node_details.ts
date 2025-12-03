import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from "@salesforce/mcp-provider-api";
import { getMessage } from "../messages.js";
import { getErrorMessage } from "../utils.js";
import { GetNodeDetailsAction, GetNodeDetailsActionImpl, GetNodeDetailsInput, GetNodeDetailsOutput } from "../actions/get-node-details.js";

const DESCRIPTION: string = `[ORCHESTRATION PATTERN - OPTIONAL FALLBACK]
Get detailed information about a specific PMD Apex AST node.

This tool provides on-demand node details when the optimized knowledge base
from create_custom_pmd_rule() doesn't include sufficient details for a specific node.

WHEN TO USE THIS TOOL:
- After calling create_custom_pmd_rule() and reviewing the knowledge_base
- When you need detailed attributes for a node not in common_nodes
- When building XPath and you need to know exact attribute names
- To understand node hierarchy and parent/child relationships

This tool:
- Loads full AST reference for the requested node
- Returns complete attribute list with types and descriptions
- Provides usage examples specific to that node
- Shows common parent nodes for context

Example workflow:
1. create_custom_pmd_rule("Find List type variables")
2. LLM sees "VariableDeclaration" in node_index but not in common_nodes
3. get_pmd_node_details("VariableDeclaration") → returns @TypeImage attribute
4. LLM builds: {"xpath": "//VariableDeclaration[starts-with(@TypeImage, 'List<')]", ...}
5. apply_custom_pmd_rule(config_json, project_root)`;

export const inputSchema = z.object({
    nodeName: z.string().describe("Name of the AST node (must match node_index from create_custom_pmd_rule). Examples: 'VariableDeclaration', 'SoqlExpression', 'DmlStatement', 'ForLoopStatement'")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    nodeName: z.string().optional().describe("The requested node name"),
    description: z.string().optional().describe("What this node represents"),
    attributes: z.array(z.object({
        name: z.string(),
        type: z.string(),
        description: z.string()
    })).optional().describe("All available attributes with types and descriptions"),
    specialNote: z.string().optional().describe("Special notes about using this node"),
    commonParents: z.array(z.string()).optional().describe("Where this node typically appears"),
    usageTip: z.string().optional().describe("Quick XPath tip for this node"),
    error: z.string().optional().describe("Error message if node not found"),
    availableNodes: z.array(z.string()).optional().describe("List of available nodes if the requested node wasn't found"),
    suggestion: z.string().optional().describe("Suggestion for next steps if there was an error")
});
type OutputArgsShape = typeof outputSchema.shape;

export class GetPmdNodeDetailsMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'get_pmd_node_details';
    private readonly action: GetNodeDetailsAction;

    public constructor(
        action: GetNodeDetailsAction = new GetNodeDetailsActionImpl()
    ) {
        super();
        this.action = action;
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.CODE_ANALYSIS];
    }

    public getName(): string {
        return GetPmdNodeDetailsMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Get PMD Node Details",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true  // This tool only reads documentation
            }
        };
    }

    public async exec(input: GetNodeDetailsInput): Promise<CallToolResult> {
        let output: GetNodeDetailsOutput;
        try {
            output = await this.action.exec(input);
        } catch (e) {
            output = { 
                error: getErrorMessage(e) 
            };
        }
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output
        };
    }
}

