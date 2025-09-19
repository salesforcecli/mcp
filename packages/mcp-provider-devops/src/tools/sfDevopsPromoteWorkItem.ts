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
    return "promote_workitem";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Promote Work Item",
      description: `Promotes approved Salesforce DevOps Work Items to the next pipeline stage/environment in the DevOps Center org. Fetches Work Items by Name and derives PipelineId and TargetStageId automatically. Returns promotion requestId for tracking.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const items = await fetchWorkItemsByNames(input.username, input.workItemNames);
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
