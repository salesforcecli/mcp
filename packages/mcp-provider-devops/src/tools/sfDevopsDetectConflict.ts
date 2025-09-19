import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { detectConflict } from "../detectConflict.js";
import { fetchWorkItemByName } from "../getWorkItems.js";
import { fetchWorkItemByNameMP } from "../getWorkItemsMP.js";
import { isManagedPackageDevopsOrg } from "../shared/orgType.js";

const inputSchema = z.object({
  username: z.string().describe("Username of the DevOps Center org"),
  workItemName: z.string().min(1).describe("Exact Work Item Name (mandatory)"),
  localPath: z.string().optional().describe("Local path to the repository (defaults to current working directory)")
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsDetectConflict extends McpTool<InputArgsShape, OutputArgsShape> {
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
    return "detect_conflict";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Detect Conflict",
      description: `Detects merge conflicts for a selected work item by name. Use when user asks to detect conflicts for a work item, or asks for help fixing a merge conflict. Provides instructions to check for conflicts between the work item branch and target branch.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const isMP = await isManagedPackageDevopsOrg(input.username);
    const workItem = isMP 
      ? await fetchWorkItemByNameMP(input.username, input.workItemName)
      : await fetchWorkItemByName(input.username, input.workItemName);
    
    const result = await detectConflict({
      workItem,
      localPath: input.localPath
    });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
}
