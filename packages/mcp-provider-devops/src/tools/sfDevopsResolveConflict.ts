import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, Services } from "@salesforce/mcp-provider-api";
import { resolveConflict } from "../resolveConflict.js";
import { fetchWorkItemByName } from "../getWorkItems.js";
import { fetchWorkItemByNameMP } from "../getWorkItemsMP.js";
import { isManagedPackageDevopsOrg } from "../shared/orgType.js";
import { normalizeAndValidateRepoPath } from "../shared/pathUtils.js";
import { usernameOrAliasParam } from "../shared/params.js";

const inputSchema = z.object({
  usernameOrAlias: usernameOrAliasParam,
  workItemName: z.string().min(1).describe("Exact Work Item Name (mandatory)"),
  localPath: z.string().describe("Local path to the repository (defaults to current working directory)")
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsResolveConflict extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly services: Services;

  constructor(services: Services) {
    super();
    this.services = services;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.GA;
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
      - workItemName (exact Name of the Work Item) and username or alias of the DevOps Center org.

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
    const connection = await this.services.getOrgService().getConnection(input.usernameOrAlias);
    const isMP = await isManagedPackageDevopsOrg(connection);
    let workItem: any;
    try {
      workItem = isMP 
        ? await fetchWorkItemByNameMP(connection, input.workItemName)
        : await fetchWorkItemByName(connection, input.workItemName);
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
          text: `Error: Work item not found. Please provide a valid work item name or valid DevOps Center org username or alias.`
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
    
    const result = await resolveConflict({
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
