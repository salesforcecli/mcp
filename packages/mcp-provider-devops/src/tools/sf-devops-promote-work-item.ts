import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
    McpTool,
    McpToolConfig,
    ReleaseState,
    Toolset,
} from "@salesforce/mcp-provider-api";
import { PromoteWorkItemAction, PromoteWorkItemInput } from "../actions/promote-work-item.js";

const DESCRIPTION = `Promotes approved Salesforce DevOps Work Items to the next pipeline stage/environment in the DevOps Center org.

**Use when user asks (examples):**
- "Promote WI-123 to UAT"
- "Promote my approved work item"
- "Release WI-456 to next stage"

**Prerequisites:**
- This tool must be used only for the DevOps Center org.
- The user must provide: username (DevOps Center), workitems (with id and PipelineStageId), and targetStageId.

**Input Parameters:**
- username: DevOps Center org username. If missing, use 'sf-devops-list-orgs' and ask user to select the DevOps Center org.
- workitems: Array of items to promote. If missing, use 'sf-devops-list-work-items' to list and select.
  - id: Work item Id
  - PipelineStageId: Current stage Id for that work item
  - TargetStageId: Destination stage Id for that work item

Mandatory steps for the LLM in this tool:
1. If DevOps Center org is not selected by user, use 'sf-devops-list-orgs' to list and select the DevOps Center org.
2. If Project is not known for which workitems are to be get, use 'sf-devops-list-projects' to list and select the project.
3. If workitems are not selected by user, use 'sf-devops-list-work-items' to list and select the workitems - give option to select multiple workitems.

**Safety and guidance for the LLM:**
- Do not auto-select a non-DevOps Center org; always confirm with the user.
- If required inputs are missing, pause and invoke the appropriate listing tools to help the user select values, then retry.
- Never promote without explicit user confirmation of workitems.

**Output:**
- JSON with promotion requestId (if available) and any error details.

**Next steps:**
- Suggest how to track promotion status using the returned requestId or the DevOps Center UI.
- If applicable, prompt the user to promote to the next stage after validation.

**Output:**
A JSON object containing the promotion request ID, the org details, and any relevant status or tracking information.`;

const inputSchema = z.object({
    username: z.string().describe("Username of the DevOps Center org"),
    project: z.object({
        id: z.string().describe("Project ID"),
        name: z.string().describe("Project name")
    }).describe("Selected project details"),
    workitems: z.array(
        z.object({
            id: z.string().describe("Work item ID"),
            PipelineId: z.string().describe("Pipeline ID"),
            PipelineStageId: z.string().describe("Current stage for this work item"),
            TargetStageId: z.string().describe("Target stage for this work item")
        })
    ).min(1).describe("Work items to promote (id and PipelineStage required)")
});

type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsPromoteWorkItemTool extends McpTool<InputArgsShape, OutputArgsShape> {
    private readonly action: PromoteWorkItemAction;

    constructor(action: PromoteWorkItemAction) {
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
        return "sf-devops-promote-work-item";
    }

    public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
        return {
            title: "Promote DevOps Work Items",
            description: DESCRIPTION,
            inputSchema: inputSchema.shape,
            outputSchema: undefined,
            annotations: {
                readOnlyHint: false,
            },
        };
    }

    public async exec(input: InputArgs): Promise<CallToolResult> {
        const promoteInput: PromoteWorkItemInput = {
            username: input.username,
            project: input.project,
            workitems: input.workitems
        };

        const result = await this.action.exec(promoteInput);

        if (result.status !== "success") {
            return {
                content: [{
                    type: "text",
                    text: result.message,
                }],
                isError: true,
            };
        }

        return {
            content: [{
                type: "text",
                text: `✅ ${result.message}`,
            }],
        };
    }
}
