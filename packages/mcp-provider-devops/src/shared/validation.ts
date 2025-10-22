import type { WorkItem } from "../types/WorkItem.js";
import { isGitRepository, hasUncommittedChanges, isSameGitRepo } from "./gitUtils.js";

export type ValidationErrorResult = { content: ({ type: "text"; text: string; [x: string]: unknown })[] };

export function validateLocalGitState(localPath?: string): ValidationErrorResult | null {
  if (!localPath) {
    return null;
  }
  if (!isGitRepository(localPath)) {
    return {
      content: [{
        type: "text",
        text: `Path validation failed: '${localPath}' is not a Git repository. Please provide the correct project path (the repository root containing a .git directory) via 'localPath', or use the checkout_devops_center_work_item tool to clone and check out the work item, then re-run conflict detection.`
      }]
    };
  }
  if (hasUncommittedChanges(localPath)) {
    return {
      content: [{
        type: "text",
        text: `Local changes detected in '${localPath}'. Please clean your working directory before conflict detection. After cleaning, re-run conflict detection.`
      }]
    };
  }
  return null;
}

export function validateWorkItemPresence(workItem?: WorkItem): ValidationErrorResult | null {
  if (!workItem) {
    return {
      content: [{
        type: "text",
        text: "Error: Please provide a workItem to check for conflicts. Use the list_devops_center_work_items tool to fetch work items first."
      }]
    };
  }
  return null;
}

export function validateWorkItemFields(workItem: WorkItem): ValidationErrorResult | null {
  if (!workItem.WorkItemBranch || !workItem.TargetBranch || !workItem.SourceCodeRepository?.repoUrl) {
    return {
      content: [{
        type: "text",
        text: "Error: Work item is missing required properties (WorkItemBranch, TargetBranch, or SourceCodeRepository.repoUrl)."
      }]
    };
  }
  return null;
}

export function validateLocalRepoMatchesWorkItemRepo(workItem: WorkItem, localPath?: string): ValidationErrorResult | null {
  if (!localPath || !workItem.SourceCodeRepository?.repoUrl) {
    return null;
  }
  const [isSameRepo, projectRepoUrl] = isSameGitRepo(workItem.SourceCodeRepository.repoUrl, localPath);
  if (!isSameRepo) {
    return {
      content: [{
        type: "text",
        text: `Error: Project in local path repo ${projectRepoUrl} is not of same git repo as ${workItem.SourceCodeRepository.repoUrl}, please checkout the correct project `
      }]
    };
  }
  return null;
}


