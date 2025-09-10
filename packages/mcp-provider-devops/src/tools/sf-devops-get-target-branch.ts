import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { GetTargetBranchAction, GetTargetBranchInput } from "../actions/get-target-branch.js";

const DESCRIPTION = `Gets the target branch for a given work item in a selected pipeline, and returns the updated work item with TargetBranch populated.

**Usage:**
1. Provide the selected work item (standard WorkItem shape).`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    workItem: z.object({
        id: z.string().describe("Work item ID"),
        name: z.string().describe("Work item name"),
        status: z.string().describe("Work item status"),
        owner: z.string().describe("Work item owner"),
        DevopsProjectId: z.string().describe("DevOps project ID")
    }).describe("Selected work item"),
    pipelineId: z.string().optional().describe("Selected pipeline Id (if omitted, list pipelines and select one first)")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsGetTargetBranchTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: GetTargetBranchAction;

    constructor(action: GetTargetBranchAction) {
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
        return "sf-devops-get-target-branch";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Get Target Branch for Work Item",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const targetBranchInput: GetTargetBranchInput = {
            username: input.username,
            workItem: input.workItem as any,
            pipelineId: input.pipelineId
        };

        const result = await this.action.exec(targetBranchInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: `Failed to get target branch: ${result.status}`,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    workItem: result.workItem,
                    targetBranch: result.targetBranch
                }, null, 2),
            }],
        };
    }
}
