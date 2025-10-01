import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { detectConflict } from "../detectConflict.js";
import { fetchWorkItemByName } from "../getWorkItems.js";
import { fetchWorkItemByNameMP } from "../getWorkItemsMP.js";
import { isManagedPackageDevopsOrg } from "../shared/orgType.js";
import { normalizeAndValidateRepoPath } from "../shared/pathUtils.js";

const inputSchema = z.object({
  username: z.string().describe("Username of the DevOps Center org"),
  workItemName: z.string().min(1).describe("Exact Work Item Name (mandatory)"),
  localPath: z.string().describe("Local path to the repository (defaults to current working directory)")
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
    return ReleaseState.GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.DEVOPS];
  }

  public getName(): string {
    return "detect_devops_center_merge_conflict";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Detect Conflict",
      description: `Detects merge conflicts for a selected work item by name.

      **When to use:**
      - User asks to detect conflicts for a work item, or asks for help fixing a merge conflict.

      **MANDATORY input:**
      - workItemName (exact Name of the Work Item). Do not list items; always use the provided name.

      **Behavior:**
      - The tool will look up the Work Item by Name in the DevOps Center org and compute target branch automatically.
      - If the item cannot be found, or required fields are missing (branch or repo), it will return actionable guidance.

      **What this tool does:**
      1. Validates required properties (WorkItemBranch, TargetBranch, SourceCodeRepository.repoUrl)
      2. Provides instructions to check for conflicts between the work item branch and target branch
      3. Runs the necessary git commands to detect conflicts and surface findings

      **Output:**
      - If conflicts exist: lists conflicted files and suggested next steps
      - If no conflicts: confirms it is safe to merge
      - On error: returns details

      **Next step:**
      - After detection, call 'resolve_devops_center_merge_conflict' to guide the user through conflict resolution.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const isMP = await isManagedPackageDevopsOrg(input.username);
    let workItem: any;
    try {
      workItem = isMP 
        ? await fetchWorkItemByNameMP(input.username, input.workItemName)
        : await fetchWorkItemByName(input.username, input.workItemName);
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error fetching work item: ${e?.message || e}` }],
        isError: true
      };
    }
    

    if (!workItem) {
      return {
        content: [{
          type: "text",
          text: `Error: Work item not found. Please provide a valid work item name or valid DevOps Center org username.`
        }]
      };
    }

    if (!input.localPath || input.localPath.trim().length === 0) {
      return {
        content: [{
          type: "text",
          text: `Error: Repository path is required. Please provide the absolute path to the git repository root.`
        }]
      };
    }
    
    const result = await detectConflict({
      workItem,
      localPath: input.localPath ? normalizeAndValidateRepoPath(input.localPath) : undefined
    });
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
}
