import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { ListWorkItemsMPAction, ListWorkItemsMPInput } from "../actions/list-work-items-mp.js";

const DESCRIPTION = `List work items for a selected DevOps project when the request comes from a Managed Package DevOps user.

**Scenario:**
- Use this tool in managed package workflows to list work items for the selected project in the DevOps Center org.
- First select the DevOps Center org (use 'sf-devops-list-orgs' if needed), then select a project ('sf-devops-list-projects').
- Pass the selected project to this tool. The behavior mirrors 'sf-devops-list-work-items' but is intended for MP call paths.

**Output:**
- Returns an array of work items (standard WorkItem shape).`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    project: z.object({
        Id: z.string().describe("Selected project's Id"),
        Name: z.string().optional()
    }).describe("DevOps project selected from sf-devops-list-projects for the same org")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsListWorkItemsMPTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: ListWorkItemsMPAction;

    constructor(action: ListWorkItemsMPAction) {
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
        return "sf-devops-list-work-items-mp";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "List Work Items (MP)",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: true,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const listInput: ListWorkItemsMPInput = {
            username: input.username,
            project: input.project
        };

        const result = await this.action.exec(listInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: `Failed to list work items: ${result.status}`,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(result.workItems, null, 2),
            }],
        };
    }
}
