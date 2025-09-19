import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { resolveConflict } from "../resolveConflict.js";
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

export class SfDevopsResolveConflict extends McpTool<InputArgsShape, OutputArgsShape> {
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
    return "resolve_conflict";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Resolve Conflict",
      description: `Provides guidance to resolve merge conflicts for a selected work item by name. Use after conflicts have been detected. Provides step-by-step instructions for resolving conflicts between the work item branch and target branch.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const isMP = await isManagedPackageDevopsOrg(input.username);
    const workItem = isMP 
      ? await fetchWorkItemByNameMP(input.username, input.workItemName)
      : await fetchWorkItemByName(input.username, input.workItemName);
    
    const result = await resolveConflict({
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
