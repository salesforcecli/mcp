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

function extractFetchErrorMessage(workItem: any): string | undefined {
  const message = workItem?.error?.message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message.trim();
  }
  return undefined;
}

function isNotFoundError(message?: string): boolean {
  if (!message) {
    return false;
  }
  return message.toLowerCase().includes("not found");
}

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
      description: `Guides merge conflict resolution for a selected work item by name.

      **When to use:**
      - After running 'detect_devops_center_merge_conflict' and conflicts were found.

      **MANDATORY input:**
      - workItemName (exact Name of the Work Item) and username or alias of the DevOps Center org.

      **Behavior:**
      - Looks up the Work Item by Name, validates required fields, and prepares per-file resolution commands.
      - If branch/target branch/repo URL are missing, returns actionable guidance to fix inputs first.
      - NEVER auto-resolve conflicts. For every conflicted file, the agent must ask the user which side to keep and wait for explicit confirmation before running any checkout command.

      **What this tool does:**
      1. Confirms the repo is in a conflicted state
      2. Lists conflicted files
      3. For each file, asks the user to choose one option only: keep current OR keep incoming
      4. After each explicit user choice, applies the selected command and stages the file
      5. Verifies conflicts are cleared and guides local commit steps

      **Hard constraints:**
      - Do not run \`git checkout --ours\` or \`git checkout --theirs\` until the user chooses for that specific file.
      - Do not offer or attempt a "keep both" merge path in this tool.
      - Keep operations local unless the user explicitly asks to push.

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
    const normalizedUsernameOrAlias = input.usernameOrAlias?.trim();
    const normalizedWorkItemName = input.workItemName?.trim();

    if (!normalizedUsernameOrAlias) {
      return {
        content: [{ type: "text", text: `Error: Username or alias of valid DevOps Center org is required` }],
        isError: true
      };
    }

    if (!normalizedWorkItemName) {
      return {
        content: [{ type: "text", text: `Error: Work item name is required` }],
        isError: true
      };
    }

    const connection = await this.services.getOrgService().getConnection(normalizedUsernameOrAlias);
    const isMP = await isManagedPackageDevopsOrg(connection);
    let workItem: any;
    try {
      if (isMP) {
        // Some orgs expose MP objects but store active DevOps Center data in standard WorkItem.
        // Prefer standard WorkItem when present; keep MP as fallback.
        const mpWorkItem = await fetchWorkItemByNameMP(connection, normalizedWorkItemName);
        let standardWorkItem: any;
        try {
          standardWorkItem = await fetchWorkItemByName(connection, normalizedWorkItemName);
        } catch {
          standardWorkItem = undefined;
        }
        const mpErrorMessage = extractFetchErrorMessage(mpWorkItem);
        if (standardWorkItem) {
          workItem = standardWorkItem;
        } else if (mpErrorMessage && isNotFoundError(mpErrorMessage)) {
          workItem = null;
        } else {
          workItem = mpWorkItem;
        }
      } else {
        workItem = await fetchWorkItemByName(connection, normalizedWorkItemName);
      }
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
        }],
        isError: true
      };
    }

    const fetchErrorMessage = extractFetchErrorMessage(workItem);
    if (fetchErrorMessage) {
      return {
        content: [{ type: "text", text: `Error fetching work item: ${fetchErrorMessage}` }],
        isError: true
      };
    }

    if (!input.localPath || input.localPath.trim().length === 0) {
      return {
        content: [{
          type: "text",
          text: `Error: Repository path is required. Please provide the absolute path to the git repository root.`
        }],
        isError: true
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
