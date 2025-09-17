import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { fetchPipelines } from "../utils/getPipelines.js";

const DESCRIPTION: string = `List all DevOps pipelines in the specified org.

**Input Parameters:**
- username: DevOps Center org username

**Output:**
- List of all pipelines with their details`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    pipelines: z.array(z.object({
        id: z.string().describe("Pipeline ID"),
        name: z.string().describe("Pipeline name")
    })).describe("List of pipelines")
});
type OutputArgsShape = typeof outputSchema.shape;

export class SfDevopsListPipelinesMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'sf-devops-list-pipelines';

    public constructor(private readonly services: Services) {
        super();
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.OTHER];
    }

    public getName(): string {
        return SfDevopsListPipelinesMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "List DevOps Pipelines",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true
            }
        };
    }

    public async exec(input: { username: string }): Promise<CallToolResult> {
        try {
            const pipelines = await fetchPipelines(input.username);
            const result = { pipelines };
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                structuredContent: result
            };
        } catch (error) {
            const errorMessage = 'Operation failed. Please check your authentication and try again.';
            return {
                content: [{ type: "text", text: `Error fetching pipelines: ${errorMessage}` }],
                isError: true
            };
        }
    }
}
