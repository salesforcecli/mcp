/**
 * Resolve deployment failure: determine if full promotion can fix based on error details.
 * For all errors except merge conflicts, we check if the source branch contains the missing
 * dependency (parsed from error details). Only if it does, full promotion can fix.
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
 * - For all other errors: try to parse a missing dependency from the error. If we cannot parse
 *   one → generic instructions (no_dependency_parsed). If we can parse one: check if source
 *   branch contains it (requires options). If in source → yes, ask confirmation. If not in source
 *   or options missing → no, generic instructions.
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
  if (!dependency) {
    return { canFix: false, reason: "no_dependency_parsed" };
  }

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

