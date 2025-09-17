import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset } from "@salesforce/mcp-provider-api";
import { getPipelineDetails } from "../utils/getPipelineDetails.js";

const DESCRIPTION: string = `Get detailed information about a specific DevOps pipeline including its stages and configuration.

**Input Parameters:**
- username: DevOps Center org username
- pipelineId: The ID of the pipeline to get details for

**Output:**
- Comprehensive pipeline information including stages, environments, and configuration`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    pipelineId: z.string().describe("The ID of the pipeline to get details for")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
    pipeline: z.object({
        id: z.string().describe("Pipeline ID"),
        name: z.string().describe("Pipeline name"),
        stages: z.array(z.object({
            id: z.string().describe("Stage ID"),
            name: z.string().describe("Stage name"),
            order: z.number().describe("Stage order")
        })).describe("Pipeline stages")
    }).describe("Pipeline details")
});
type OutputArgsShape = typeof outputSchema.shape;

export class SfDevopsGetPipelineDetailsMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
    public static readonly NAME: string = 'sf-devops-get-pipeline-details';

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
        return SfDevopsGetPipelineDetailsMcpTool.NAME;
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Get DevOps Pipeline Details",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: outputSchema.shape,
            annotations: {
                readOnlyHint: true
            }
        };
    }

    public async exec(input: { username: string; pipelineId: string }): Promise<CallToolResult> {
        try {
            const result = await getPipelineDetails(input.username, input.pipelineId);
            
            const response = { pipeline: result };
            return {
                content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
                structuredContent: response
            };
        } catch (error) {
            const errorMessage = 'Operation failed. Please check your authentication and try again.';
            return {
                content: [{ type: "text", text: `Error getting pipeline details: ${errorMessage}` }],
                isError: true
            };
        }
    }
}
