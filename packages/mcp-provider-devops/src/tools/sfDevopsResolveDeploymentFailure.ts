import { execSync } from "node:child_process";
import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, Services } from "@salesforce/mcp-provider-api";
import { usernameOrAliasParam } from "../shared/params.js";
import { normalizeAndValidateRepoPath, isSalesforceOrDevOpsProject } from "../shared/pathUtils.js";
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
1. **Merge conflict**: Full promotion cannot fix → instruct to use **resolve_devops_center_merge_conflict**.
2. **All other errors**: The tool **checks out the source branch** in the repo (at localPath), then parses the error for a missing dependency and checks if the **source branch** contains it. If **source contains the missing dependency** → full promotion can fix → ask for confirmation (see below), then proceed to full promotion after user confirms. If **source does not contain it** (or no dependency could be parsed) → return generic instructions to resolve the deployment failure.

**MANDATORY – Ask for confirmation; do NOT run full promotion without it:**
- When this tool returns that full promotion can fix the failure, you MUST present the confirmation request to the user and STOP.
- Do NOT call **promote_devops_center_work_item** until the user explicitly confirms (e.g. "Yes", "Proceed", "Go ahead").
- Only after the user confirms should you call **promote_devops_center_work_item** with usernameOrAlias, workItemNames: [workItemName], isFullDeploy: true.`,
      inputSchema: inputSchema.shape,
      outputSchema: undefined,
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const resolvedPath = normalizeAndValidateRepoPath(input.localPath?.trim() || undefined);
    if (!isSalesforceOrDevOpsProject(resolvedPath)) {
      return {
        content: [{
          type: "text",
          text: `The path is not a Salesforce/DevOps project (expected a Git repository with Salesforce layout, e.g. \`sfdx-project.json\`, \`force-app/\`, or \`main/\`).

**Please provide the local path** to your Salesforce/DevOps repository (**localPath**). Current path used: \`${resolvedPath}\`

If your current working directory is not the repo root, pass the absolute path to the repository root so the tool can check the source branch for the missing dependency.`
        }],
        isError: false
      };
    }

    // Checkout source branch before checking for dependency
    try {
      try {
        execSync(`git checkout "${input.sourceBranchName}"`, {
          cwd: resolvedPath,
          stdio: ["ignore", "pipe", "pipe"],
          encoding: "utf8",
        });
      } catch (checkoutErr: unknown) {
        const stderr = (checkoutErr as { stderr?: string })?.stderr ?? String(checkoutErr);
        const isUnknownBranch = /did not match any file|unknown revision|path.*does not exist/i.test(stderr) || /branch.*not found/i.test(stderr);
        if (isUnknownBranch) {
          execSync(`git fetch origin "${input.sourceBranchName}" --prune`, {
            cwd: resolvedPath,
            stdio: ["ignore", "pipe", "pipe"],
            encoding: "utf8",
          });
          execSync(`git checkout -B "${input.sourceBranchName}" "origin/${input.sourceBranchName}"`, {
            cwd: resolvedPath,
            stdio: ["ignore", "pipe", "pipe"],
            encoding: "utf8",
          });
        } else {
          throw checkoutErr;
        }
      }
    } catch (err: unknown) {
      const stderr = (err as { stderr?: string })?.stderr ?? "";
      const message = (err as { message?: string })?.message ?? String(err);
      const out = [stderr, message].filter(Boolean).join("\n");
      const hint = /uncommitted|would be overwritten|local changes/i.test(out)
        ? " Stash or commit your changes, then re-run this tool."
        : " Ensure the source branch exists (locally or on origin) and re-run.";
      return {
        content: [{
          type: "text",
          text: `Could not checkout source branch "${input.sourceBranchName}" in \`${resolvedPath}\`.${hint}\n\nDetails: ${out.trim() || message}`
        }],
        isError: true
      };
    }

    const options = {
      localPath: resolvedPath,
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

    // Source branch does not contain the missing dependency, or dependency could not be parsed, or path required
    if (!canFix) {
      const specificContext =
        reason === "dependency_not_in_source_branch" && missingDependencyName
          ? `The missing dependency "${missingDependencyName}" was not found in source branch "${input.sourceBranchName}". `
          : reason === "local_path_required"
            ? `To check whether the source branch contains the missing dependency, provide **localPath** (repository path). `
            : "";
      return {
        content: [{
          type: "text",
          text: `Full promotion **cannot** fix this failure based on the check. ${specificContext}

**Generic instructions to resolve the deployment failure:**
- Review the deployment error details and identify any missing metadata or dependencies.
- Add missing components in a separate work item, promote that work item first, then retry promoting "${input.workItemName}".
- If there are merge conflicts, use **resolve_devops_center_merge_conflict** with workItemName: "${input.workItemName}", then commit, push, and retry.
- If the error persists, check pipeline logs or contact your DevOps admin.`
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
