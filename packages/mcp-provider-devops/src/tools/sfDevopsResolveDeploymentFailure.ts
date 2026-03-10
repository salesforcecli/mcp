import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, Services } from "@salesforce/mcp-provider-api";
import { usernameOrAliasParam } from "../shared/params.js";
import { normalizeAndValidateRepoPath } from "../shared/pathUtils.js";
import { canFullPromotionFixFailure } from "../resolveDeploymentFailure.js";

const inputSchema = z.object({
  usernameOrAlias: usernameOrAliasParam,
  workItemName: z.string().min(1).describe("Work Item name (mandatory). Exact name of the work item that failed deployment."),
  sourceBranchName: z.string().min(1).describe("Source branch name (mandatory). The work item branch where the change lives."),
  errorDetails: z.string().min(1).describe("Error details from the failed deployment (mandatory). Used to determine if full promotion can fix the failure."),
  localPath: z.string().optional().describe("Local path to the repository (optional). Required only for dependency-type errors: used to check if the source branch contains the missing dependency. If provided and valid, the tool checks the branch; if dependency is present, full promotion can fix.")
});
type InputArgs = z.infer<typeof inputSchema>;
type InputArgsShape = typeof inputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SfDevopsResolveDeploymentFailure extends McpTool<InputArgsShape, OutputArgsShape> {
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
    return "resolve_devops_center_deployment_failure";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Resolve Deployment Failure",
      description: `Determine if **full promotion** can fix a deployment failure and guide the user.

**Inputs:** workItemName (mandatory), sourceBranchName (mandatory), errorDetails (mandatory), localPath (optional).

**Behavior:**
1. **If full promotion cannot fix** (e.g. merge conflict): Return instructions to use **resolve_devops_center_merge_conflict** or to add the missing dependency in a separate work item.
2. **If full promotion can fix** (anything other than merge conflict):
   - For dependency-type errors (e.g. "Variable does not exist"): If **localPath** is not provided, ask the user for the local path of the source branch. If provided, check whether the missing dependency exists in the source branch. If **present** → ask the user for confirmation (see below). If **not present** → instruct the user to create a new work item for the missing dependency, promote it first, then retry.
   - For other errors: Ask the user for confirmation (see below).

**MANDATORY – Ask for confirmation; do NOT run full promotion without it:**
- When this tool returns that full promotion can fix the failure, you MUST present the confirmation request to the user and STOP.
- Do NOT call **promote_devops_center_work_item** until the user explicitly confirms (e.g. "Yes", "Proceed", "Go ahead").
- Only after the user confirms should you call **promote_devops_center_work_item** with usernameOrAlias, workItemNames: [workItemName], isFullDeploy: true.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    let options: { localPath: string; sourceBranchName: string } | undefined;
    let pathInvalid = false;
    if (input.localPath?.trim()) {
      try {
        options = {
          localPath: normalizeAndValidateRepoPath(input.localPath),
          sourceBranchName: input.sourceBranchName,
        };
      } catch {
        pathInvalid = true;
      }
    }

    const { canFix, reason, missingDependencyName } = canFullPromotionFixFailure(input.errorDetails, options);

    // Full promotion cannot fix: merge conflict → use merge conflict tool
    if (!canFix && reason === "merge_conflict") {
      return {
        content: [{
          type: "text",
          text: `This failure is a **merge conflict**. Full promotion will not fix it.

**Use resolve_devops_center_merge_conflict** with workItemName: "${input.workItemName}", then resolve the conflicted file(s), commit, push, and retry promotion.`
        }],
        isError: false
      };
    }

    // Dependency-type error but no valid localPath: ask for path or suggest new work item
    if (reason === "local_path_required" || (pathInvalid && !canFix)) {
      return {
        content: [{
          type: "text",
          text: `The error suggests a missing dependency${missingDependencyName ? ` (e.g. ${missingDependencyName})` : ""}. To see if full promotion can fix it, the tool must check whether that dependency exists in the source branch.

**Please provide the local path** to your repo (**localPath**). The tool will check branch "${input.sourceBranchName}":
- If the dependency is in the branch → full promotion can fix (you'll be asked to confirm).
- If not → create a new work item for the missing dependency, promote it first, then retry "${input.workItemName}".

If you cannot provide a path, create a new work item that adds the missing dependency, promote it, then retry.`
        }],
        isError: false
      };
    }

    // Dependency missing in source branch
    if (!canFix && reason === "dependency_not_in_source_branch") {
      return {
        content: [{
          type: "text",
          text: `Full promotion **cannot** fix this. The missing dependency${missingDependencyName ? ` (${missingDependencyName})` : ""} was not found in branch "${input.sourceBranchName}".

**Next step:** Create a new work item that adds this dependency, promote it so it exists in the pipeline, then retry promoting "${input.workItemName}".`
        }],
        isError: false
      };
    }

    // Any other "cannot fix" case
    if (!canFix) {
      return {
        content: [{
          type: "text",
          text: `Full promotion cannot fix this failure. Create a new work item that adds the missing metadata, promote it first, then retry "${input.workItemName}".`
        }],
        isError: false
      };
    }

    // Full promotion can fix — ask for confirmation; do NOT call promote until user explicitly confirms
    return {
      content: [{
        type: "text",
        text: `**Full promotion can resolve this failure** based on the error details.

**Ask for confirmation:** Do not run full promotion until the user explicitly confirms. Present this to the user:

"Full promotion can fix this. Do you want me to run full promotion for work item ${input.workItemName}? Reply **Yes**, **Proceed**, or **Go ahead** to confirm."

Only after the user confirms should you call **promote_devops_center_work_item** with:
- usernameOrAlias: "${input.usernameOrAlias}"
- workItemNames: ["${input.workItemName}"]
- isFullDeploy: true`
      }],
      isError: false
    };
  }
}
