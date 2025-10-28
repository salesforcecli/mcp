import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import { commitWorkItem } from "../commitLiteWorkItem.js";
import { fetchWorkItemByName } from "../getWorkItems.js";
import { normalizeAndValidateRepoPath } from "../shared/pathUtils.js";
import { randomUUID } from 'crypto';

const inputSchema = z.object({
  username: z.string().optional().describe("Username of the DevOps Center org"),
  alias: z.string().optional().describe("alias of the DevOps Center org"),
  workItemName: z.string().min(1).describe("Exact Work Item Name to commit workitem."),
  commitMessage: z.string().describe("Commit message describing the changes (ask user for input)"),
  repoPath: z.string().describe("Absolute path to the git repository root. Defaults to current working directory.")
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsCommitWorkItem extends McpTool<InputArgsShape, OutputArgsShape> {
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
    return "commit_devops_center_work_item";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Commit Work Item",
      description: `Commit SFDX project changes and register the commit SHA in DevOps Center.

**CRITICAL:** Do not run git commands (git add/commit/push) manually. When a user asks to commit, call this tool so DevOps Center correctly tracks metadata and links the commit to the Work Item.

**Inputs to validate before execution:**
1. DevOps Center org identifier (username or alias)
2. Work Item Name that resolves in the org
3. Repository path pointing to the project root (git repo)
4. Non-empty commit message

**Use this tool to:**
- Finalize and record changes for a Work Item in DevOps Center
- Commit using DevOps Center credentials and conventions
- Ensure metadata changes are captured correctly in the pipeline

**After execution:**
- Follow the returned instructions to push (if not pushed automatically)
- Then create a PR (use 'create_devops_center_pull_request') as the next step

**Output:**
- commitSha: The resulting commit SHA (plus push instructions if applicable)

**Example:**
- "Commit my changes with message 'Fix bug in account logic' and tie it to WI-1092."`,
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

    if (!input.workItemName) {
      return {
        error: {
          content: [{ type: "text", text: `Error: Work item name is required` }],
          isError: true
        }
      };
    }

    let workItem: any;
    try {
      const usernameOrAlias = input.username ?? input.alias;
      if (!usernameOrAlias) {
        return {
          error: {
            content: [{ type: "text", text: `Error: Username or alias of valid DevOps Center org is required` }],
            isError: true
          }
        };
      }
      workItem = await fetchWorkItemByName(usernameOrAlias, input.workItemName);
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

    if (!input.repoPath || input.repoPath.trim().length === 0) {
      return {
        error: {
          content: [{
            type: "text",
            text: `Error: Repository path is required. Please provide the absolute path to the git repository root.`
          }]
        }
      };
    }

    const localPath = normalizeAndValidateRepoPath(input.repoPath);
    return { workItem, localPath };
  }


  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      const validation = await this.validateAndPrepare(input);
    if ("error" in validation) {
      return validation.error;
    }

    const { workItem, localPath } = validation;
      if (!input.repoPath || input.repoPath.trim().length === 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Repository path is required. Please provide the absolute path to the git repository root.`
          }]
        };
      }
      

      if (!input.commitMessage || input.commitMessage.trim().length === 0) {
        return {
          content: [{
            type: "text",
            text: `Error: Commit message is required. Please provide a meaningful commit message describing your changes.`
          }]
        };
      }


      const requestId = randomUUID();
      
      const result = await commitWorkItem({
        username: input.username ?? input.alias ?? '',
        workItem: workItem,
        requestId: requestId,
        commitMessage: input.commitMessage,
        repoPath: localPath
      });

      if (result && Array.isArray((result as any).content)) {
        return {
          content: (result as any).content
        };
      }

      const instructions = `Commit created successfully.\n\nAgent execution guide (perform these steps now):\n- Ensure your working directory is: '${localPath}'\n- Push the commit: 'git push origin HEAD'\n- After push succeeds, create a PR using 'create_devops_center_pull_request'`;

      return {
        content: [
          { type: "text", text: instructions, actionRequired: true },
          { type: "text", text: JSON.stringify(result, null, 2) }
        ]
      };
    } catch (error: any) {
      return {
        content: [{
          type: "text",
          text: `Error committing work item: ${error.message}`
        }]
      };
    }
  }
}
