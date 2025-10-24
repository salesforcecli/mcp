import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { detectConflict } from "../detectConflict.js";
import { fetchWorkItemByName } from "../getWorkItems.js";
import { fetchWorkItemByNameMP } from "../getWorkItemsMP.js";
import { isManagedPackageDevopsOrg } from "../shared/orgType.js";
import { normalizeAndValidateRepoPath } from "../shared/pathUtils.js";

const inputSchema = z.object({
  username: z.string().optional().describe("Username of the DevOps Center org"),
  alias: z.string().optional().describe("alias of the DevOps Center org"),
  workItemName: z.string().optional().describe("Exact Work Item Name"),
  sourcebranch: z.string().optional().describe("Source branch of the Work Item"),
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
      description: `Detects merge conflicts for a selected work item or in given source branch.

      **When to use:**
      - User asks to detect conflicts for a work item, or asks for help fixing a merge conflict.
      - User asks to detect conflicts for a given source branch.

      **MANDATORY input:**
      - Either workitem name (example WI-0000000X) or source branch (example WI-0000000X) is provided.
      - Either username (example devops-center-org) or alias (example devops-center-org) is provided.

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

  private async validateAndPrepare(input: InputArgs): Promise<{ workItem: any; localPath: string } | { error: CallToolResult }> {
    if (!input.username && !input.alias) {
      return {
        error: {
          content: [{ type: "text", text: `Error: Username or alias of valid DevOps Center org is required` }],
          isError: true
        }
      };
    }

    if (!input.workItemName && !input.sourcebranch) {
      return {
        error: {
          content: [{ type: "text", text: `Error: Work item name or source branch is required` }],
          isError: true
        }
      };
    }

    let workItem: any;
    try {
      const isMP = await isManagedPackageDevopsOrg(input.username, input.alias);
      const effectiveWorkItemName = input.workItemName || input.sourcebranch;
      const usernameOrAlias = input.username ?? input.alias;
      if (!usernameOrAlias) {
        return {
          error: {
            content: [{ type: "text", text: `Error: Username or alias of valid DevOps Center org is required` }],
            isError: true
          }
        };
      }
      workItem = isMP
        ? await fetchWorkItemByNameMP(usernameOrAlias, effectiveWorkItemName as string)
        : await fetchWorkItemByName(usernameOrAlias, effectiveWorkItemName as string);
    } catch (e: any) {
      return {
        error: {
          content: [{ type: "text", text: `Error fetching work item: ${e?.message || e}` }],
          isError: true
        }
      };
    }

    if (!workItem) {
      return {
        error: {
          content: [{
            type: "text",
            text: `Error: Work item not found. Please provide a valid work item name or valid DevOps Center org username.`
          }]
        }
      };
    }

    if (!input.localPath || input.localPath.trim().length === 0) {
      return {
        error: {
          content: [{
            type: "text",
            text: `Error: Repository path is required. Please provide the absolute path to the git repository root.`
          }]
        }
      };
    }

    const localPath = normalizeAndValidateRepoPath(input.localPath);
    return { workItem, localPath };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const validation = await this.validateAndPrepare(input);
    if ("error" in validation) {
      return validation.error;
    }

    const { workItem, localPath } = validation;
    let result: any;
    try {
      result = await detectConflict({
        workItem,
        localPath
      });
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error detecting conflict: ${e?.message || e}` }],
        isError: true
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
}
