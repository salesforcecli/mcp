import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { promoteWorkItems } from "../promoteWorkItems.js";
import { fetchWorkItemsByNames } from "../getWorkItems.js";

const inputSchema = z.object({
  username: z.string().describe("Username of the DevOps Center org"),
  workItemNames: z.array(z.string().min(1)).nonempty().describe("Exact Work Item Names to promote")
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsPromoteWorkItem extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly telemetryService: TelemetryService;

  constructor(telemetryService: TelemetryService) {
    super();
    this.telemetryService = telemetryService;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.DEVOPS];
  }

  public getName(): string {
    return "promote_devops_center_work_item";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Promote Work Item",
      description: `Promote an approved work item to the next stage in the DevOps Center pipeline.

      **Use when user asks (examples):**
      - "Promote WI-123 to UAT"
      - "Promote my approved work item"
      - "Release WI-456 to next stage"

      **Prerequisites:**
      - This tool must be used only for the DevOps Center org.
      - The user must provide: username (DevOps Center) and a list of Work Item Names.

      **Input Parameters:**
      - username: DevOps Center org username. If missing, use 'list_all_orgs' and ask user to select the DevOps Center org.
      - workItemNames: Array of exact Work Item Names to promote.

      **Behavior:**
      1. Fetches the specified Work Items by Name and derives PipelineId and TargetStageId automatically.
      2. Validates that each Work Item has PipelineStageId and a resolvable TargetStageId.
      3. Calls the promotion API with the resolved ids.


      **Safety and guidance for the LLM:**
      - Do not auto-select a non-DevOps Center org; always confirm with the user.
      - If any Work Item is not found or missing required pipeline data, return an actionable error listing which names failed.
      - Never promote without explicit user confirmation of workitems.

      **Output:**
      - JSON with promotion requestId (if available) and any error details.

      **Next steps:**
      - Suggest how to track promotion status using the returned requestId or the DevOps Center UI.
      - If applicable, prompt the user to promote to the next stage after validation.

      **Output:**
      A JSON object containing the promotion request ID, the org details, and any relevant status or tracking information.
      `,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    let items: any[] | any;
    try {
      items = await fetchWorkItemsByNames(input.username, input.workItemNames);
    } catch (e: any) {
      return { content: [{ type: "text", text: `Error fetching work items: ${e?.message || e}` }], isError: true };
    }
    if (!Array.isArray(items) || items.length === 0) {
      return { content: [{ type: "text", text: "No matching Work Items found for provided names." }] };
    }

    const missing: string[] = [];
    const prepared = items.map((wi: any) => {
      if (!wi.id || !wi.TargetStageId || !wi.PipelineId) {
        missing.push(wi.name || wi.id);
      }
      return {
        id: wi.id,
        PipelineStageId: wi.PipelineStageId || undefined,
        TargetStageId: wi.TargetStageId,
        PipelineId: wi.PipelineId
      };
    });

    if (missing.length) {
      return { content: [{ type: "text", text: `Cannot promote due to missing pipeline data for: ${missing.join(", ")}. Ensure each item has a pipeline stage and target stage.` }] };
    }

    const result = await promoteWorkItems(input.username, { workitems: prepared });
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
}
