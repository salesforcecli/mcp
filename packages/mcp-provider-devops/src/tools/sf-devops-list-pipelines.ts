import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { ListPipelinesAction, ListPipelinesInput } from "../actions/list-pipelines.js";

const DESCRIPTION = `Lists DevOps Center Pipelines available in the DevOps Center org using SOQL on DevopsPipeline.

**MANDATORY:** Use this tool only for the DevOps Center org. If the org is not provided, use 'sf-devops-list-orgs' to select it.`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsListPipelinesTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: ListPipelinesAction;

    constructor(action: ListPipelinesAction) {
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
        return "sf-devops-list-pipelines";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "List DevOps Center Pipelines",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const listInput: ListPipelinesInput = {
            username: input.username
        };

        const result = await this.action.exec(listInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: `Failed to list pipelines: ${result.status}`,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(result.pipelines, null, 2),
            }],
        };
    }
}
