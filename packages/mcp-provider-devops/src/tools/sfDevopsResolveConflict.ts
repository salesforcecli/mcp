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
    return "resolve_devops_center_merge_conflict";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Resolve Conflict",
      description: `Resolves merge conflicts for a selected work item by name.

      **When to use:**
      - After running 'detect_devops_center_merge_conflict' and conflicts were found.

      **MANDATORY input:**
      - workItemName (exact Name of the Work Item) and username of the DevOps Center org.

      **Behavior:**
      - Looks up the Work Item by Name, validates required fields, and prepares per-file resolution commands.
      - If branch/target branch/repo URL are missing, returns actionable guidance to fix inputs first.

      **What this tool does:**
      1. Confirms the repo is in a conflicted state
      2. Lists conflicted files
      3. For each file, provides choices (keep current / keep incoming / keep both ) with exact git commands
      4. Guides removing conflict markers, staging, and committing

      **Output:**
      - If conflicts exist: per-file action plan with commands
      - If no conflicts: confirms the repo is clean
      - On error: actionable troubleshooting
`,
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
