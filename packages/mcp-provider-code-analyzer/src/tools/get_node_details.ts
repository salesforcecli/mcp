import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { getErrorMessage } from "../utils.js";
import { GetNodeDetailsAction, GetNodeDetailsActionImpl, GetNodeDetailsInput, GetNodeDetailsOutput } from "../actions/get-node-details.js";

const DESCRIPTION: string = `Get detailed information about AST nodes for building XPath rules.

WHEN TO USE THIS TOOL:
- After calling create_code_analyzer_custom_rule, use this tool to get detailed node information
- Call this with the array of node names you identified from availableNodes
- This provides attributes (direct + inherited from parent classes) and important notes needed to build XPath expressions

⚠️ IMPORTANT:
- Always call this tool after identifying which nodes you need from availableNodes
- Pass an array of node names (e.g., ["UserClass", "Method", "MethodCallExpression"])
- The tool returns ALL attributes for each node: direct attributes + inherited attributes from parent classes

Example workflow:
1. Call create_code_analyzer_custom_rule(engine, language) → get availableNodes
2. Identify needed nodes (e.g., UserClass, Method)
3. Call get_node_details(engine, language, ["UserClass", "Method"]) → get all attributes (direct + parent class) and important notes
4. Use the complete attribute list to build XPath expression`;

export const inputSchema = z.object({
    engine: z.enum(['pmd', 'eslint', 'regex']).describe("Required: Which engine to get node details for."),
    language: z.string().describe("Required: The target language. Examples: 'apex', 'javascript', 'typescript', 'html', 'xml', 'visualforce'"),
    nodeNames: z.array(z.string()).min(1).describe("Required: Array of node names to get details for. Example: ['UserClass', 'Method', 'MethodCallExpression']")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    status: z.string().describe("'success' if successful, 'error' otherwise"),
    nodeDetails: z.array(z.object({
        name: z.string().describe("Node name (can be a requested node or a parent class)"),
        description: z.string().describe("Description of what the node represents"),
        category: z.string().optional().describe("Category of the node (e.g., 'Class', 'Expressions', 'Modifiers', 'Inheritance')"),
        extends: z.string().optional().describe("Parent class that this node extends (only present for requested nodes, not parent classes)"),
        implements: z.array(z.string()).optional().describe("Interfaces that this node implements"),
        attributes: z.array(z.object({
            name: z.string().describe("Attribute name (e.g., '@Image', '@Name')"),
            type: z.string().describe("Attribute type (e.g., 'string', 'boolean', 'array')"),
            description: z.string().describe("Description of what the attribute represents")
        })).describe("List of attributes. For requested nodes, these are direct attributes only. For parent classes, these are all attributes available from that parent.")
    })).optional().describe("Array of node details. Includes requested nodes (with only direct attributes) and their parent classes (as separate entries with all their attributes)"),
    importantNotes: z.array(z.object({
        title: z.string().describe("Title of the important note"),
        content: z.string().describe("Content explaining the important note")
    })).optional().describe("Critical notes about common pitfalls and correct attribute usage for XPath generation"),
    error: z.string().optional().describe("Error message if something went wrong")
});
type OutputArgsShape = typeof outputSchema.shape;

export class GetNodeDetailsMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'get_node_details';
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
        return GetNodeDetailsMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Get Node Details",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true  // This tool only reads files
            }
        };
    }

    /**
     * Executes the get node details tool by validating input and delegating to the action.
     * 
     * This method validates the input parameters, calls the action to retrieve detailed
     * information about AST nodes including their attributes and inheritance relationships,
     * and returns the result in both text and structured formats. Errors are caught and
     * returned as error status in the output.
     * 
     * @param input - The input parameters containing engine, language, and array of node names
     * @returns A CallToolResult containing node details with attributes (direct and inherited)
     *          and important notes, or an error status
     * @throws Never throws - all errors are caught and returned in the output structure
     */
    public async exec(input: GetNodeDetailsInput): Promise<CallToolResult> {
        let output: GetNodeDetailsOutput;
        try {
            validateInput(input);
            output = await this.action.exec(input);
        } catch (e) {
            output = { 
                status: "error",
                error: getErrorMessage(e) 
            };
        }
        return {
            content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
            structuredContent: output
        };
    }
}

/**
 * Validates the input parameters for the get node details tool.
 * 
 * Ensures that engine, language, and nodeNames are provided and that language is not empty.
 * Note: Engine and nodeNames are also validated by Zod schema, but this provides an additional check.
 * 
 * @param input - The input parameters to validate
 * @throws Error if engine is missing, language is missing/empty, or nodeNames array is empty
 */
function validateInput(input: GetNodeDetailsInput): void {
    if (!input.engine) {
        throw new Error("Valid engine is required.");
    }

    if (!input.language || input.language.trim().length === 0) {
        throw new Error("language is required and cannot be empty");
    }

    if (!input.nodeNames || input.nodeNames.length === 0) {
        throw new Error("At least one node name is required in nodeNames array");
    }
}

