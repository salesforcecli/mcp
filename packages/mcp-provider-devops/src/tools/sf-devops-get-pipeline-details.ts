import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { GetPipelineDetailsAction, GetPipelineDetailsInput } from "../actions/get-pipeline-details.js";

const DESCRIPTION = `Gets pipeline and environments details for a selected DevOps pipeline in the DevOps Center org, including:
- Stages with environment and repository branch details
- Development environments not yet assigned to the pipeline

**Requirements:**
- Use for the DevOps Center org only.
- A pipeline must be selected first (provide its Id). If the user hasn't selected a pipeline yet, first call 'sf-devops-list-pipelines' for the same DevOps Center org, ask the user to select one, and then pass the selected pipeline's Id here. Ensure the org used for listing and details is the same.`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    pipelineId: z.string().describe("Selected DevOps Pipeline Id")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsGetPipelineDetailsTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: GetPipelineDetailsAction;

    constructor(action: GetPipelineDetailsAction) {
        super();
        this.action = action;
    }

    public getReleaseState(): ReleaseState {
        return ReleaseState.NON_GA;
    }

    public getToolsets(): Toolset[] {
        return [Toolset.OTHER];
    }

    public getName(): string {
        return "sf-devops-get-pipeline-details";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Get DevOps Pipeline Details",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const detailsInput: GetPipelineDetailsInput = {
            username: input.username,
            pipelineId: input.pipelineId
        };

        const result = await this.action.exec(detailsInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: `Failed to get pipeline details: ${result.status}`,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: result.message,
            }],
        };
    }
}
