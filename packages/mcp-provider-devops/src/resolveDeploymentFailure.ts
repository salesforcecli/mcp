/**
 * Resolve deployment failure: determine if full promotion can fix based on error details.
 * Full promotion can fix anything except merge conflicts. For dependency-type errors we optionally
 * verify the missing dependency exists in the source branch (requires localPath).
 */

import {
  parseMissingDependency,
  getSourcePathsForDependency,
  isDependencyPresentInBranch,
} from "./shared/dependencyInBranch.js";

/** Merge conflict errors: full promotion cannot fix. */
function isMergeConflict(errorSummary: string): boolean {
  return /MERGE_CONFLICT|CONFLICTS:/i.test(errorSummary);
}

export interface ResolveDeploymentFailureOptions {
  localPath: string;
  sourceBranchName: string;
  targetBranchName?: string;
}

/**
 * Can full promotion fix this failure?
 * - Merge conflict → no; use merge conflict tool.
 * - Missing dependency (e.g. "Variable does not exist: X"): need localPath to check source branch;
 *   if not provided → local_path_required; if provided and dependency in source → yes; else no.
 *   When targetBranchName is provided, also checks target branch and returns inTargetBranch for comparison.
 * - All other errors → yes.
 */
export function canFullPromotionFixFailure(
  errorDetails: string,
  options?: ResolveDeploymentFailureOptions
): {
  canFix: boolean;
  reason: string;
  missingDependencyName?: string;
  inTargetBranch?: boolean;
} {
  if (isMergeConflict(errorDetails)) {
    return { canFix: false, reason: "merge_conflict" };
  }

  const dependency = parseMissingDependency(errorDetails);
  if (dependency) {
    if (!options) {
      return {
        canFix: false,
        reason: "local_path_required",
        missingDependencyName: dependency.name,
      };
    }
    const paths = getSourcePathsForDependency(dependency.type, dependency.name);
    const inSource =
      paths.length > 0 &&
      isDependencyPresentInBranch(options.localPath, options.sourceBranchName, paths);
    if (!inSource) {
      return {
        canFix: false,
        reason: "dependency_not_in_source_branch",
        missingDependencyName: dependency.name,
      };
    }
    let inTargetBranch: boolean | undefined;
    if (options.targetBranchName && paths.length > 0) {
      inTargetBranch = isDependencyPresentInBranch(
        options.localPath,
        options.targetBranchName,
        paths
      );
    }
    return {
      canFix: true,
      reason: "dependency_in_source_branch",
      missingDependencyName: dependency.name,
      inTargetBranch,
    };
  }

  return { canFix: true, reason: "full_promotion_can_fix" };
}

