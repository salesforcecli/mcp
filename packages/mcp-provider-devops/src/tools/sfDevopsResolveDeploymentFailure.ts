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
  targetBranchName: z.string().min(1).optional().describe("Target branch name (optional). When provided with localPath, the tool compares source and target to determine if the missing dependency is in source but not in target, confirming full promotion will resolve the failure."),
  errorDetails: z.string().min(1).describe("Error details from the failed deployment (mandatory). Used to determine if full promotion can fix the failure."),
  localPath: z.string().optional().describe("Local path to the repository (defaults to current working directory)")
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

**Inputs:** workItemName (mandatory), sourceBranchName (mandatory), errorDetails (mandatory), localPath (optional; defaults to current working directory), targetBranchName (optional; when provided, source and target are compared to confirm if full promotion will resolve).

**Behavior:**
1. **If full promotion cannot fix** (e.g. merge conflict): Return instructions to use **resolve_devops_center_merge_conflict** or to add the missing dependency in a separate work item.
2. **If full promotion can fix** (anything other than merge conflict):
   - For dependency-type errors (e.g. "Variable does not exist"): Use **localPath** to check whether the missing dependency exists in the source branch. If **targetBranchName** is provided, the tool compares source and target (dependency in source but not in target → full promotion will resolve). If **present in source** → ask the user for confirmation (see below). If **not present in source** → instruct the user to create a new work item for the missing dependency, promote it first, then retry.
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
    const options = {
      localPath: normalizeAndValidateRepoPath(input.localPath?.trim() || undefined),
      sourceBranchName: input.sourceBranchName,
      ...(input.targetBranchName?.trim() && { targetBranchName: input.targetBranchName.trim() }),
    };

    const { canFix, reason, missingDependencyName, inTargetBranch } = canFullPromotionFixFailure(input.errorDetails, options);

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
    const comparisonNote =
      reason === "dependency_in_source_branch" && missingDependencyName && input.targetBranchName?.trim()
        ? inTargetBranch === false
          ? ` The missing dependency "${missingDependencyName}" is in source branch "${input.sourceBranchName}" but not in target branch "${input.targetBranchName}"; full promotion will resolve this.`
          : ` The dependency "${missingDependencyName}" is present in both source and target branches; full promotion will resolve.`
        : "";
    return {
      content: [{
        type: "text",
        text: `**Full promotion can resolve this failure** based on the error details.${comparisonNote}

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
