import type { WorkItem } from './types/WorkItem.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export interface DetectConflictParams {
  workItem?: WorkItem;
  localPath?: string;
}

function isGitRepository(candidatePath: string): boolean {
  const gitPath = path.join(candidatePath, '.git');
  if (!fs.existsSync(gitPath)) {
    return false;
  }
  const stat = fs.statSync(gitPath);
  if (stat.isDirectory()) {
    return true;
  }
  if (stat.isFile()) {
    try {
      const content = fs.readFileSync(gitPath, 'utf8');
      return content.trim().startsWith('gitdir:');
    } catch {
      return false;
    }
  }
  return false;
}

function hasUncommittedChanges(candidatePath: string): boolean {
  try {
    const output = execSync('git status --porcelain', { cwd: candidatePath, stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
    return output.length > 0;
  } catch {
    // If git isn't available or the command fails, do not block
    return false;
  }
}

export async function detectConflict({
  workItem,
  localPath
}: DetectConflictParams): Promise<{ content: ({ type: "text"; text: string; [x: string]: unknown })[] }> {
  
  // Validate that repoPath points to a Git repository
  if (localPath && !isGitRepository(localPath)) {
    return {
      content: [{
        type: "text",
        text: `Path validation failed: '${localPath}' is not a Git repository. Please provide the correct project path (the repository root containing a .git directory) via 'localPath', or use the checkout_devops_center_work_item tool to clone and check out the work item, then re-run conflict detection.`
      }]
    };
  }

  // Block if there are local uncommitted changes
  if (localPath && hasUncommittedChanges(localPath)) {
    return {
      content: [{
        type: "text",
        text: `Local changes detected in '${localPath}'. Please clean your working directory before conflict detection. After cleaning, re-run conflict detection.`
      }]
    };
  }

  // If no workItem is provided, we need to fetch work items and ask user to select one
  if (!workItem) {
    return {
      content: [{
        type: "text",
        text: "Error: Please provide a workItem to check for conflicts. Use the list_devops_center_work_items tool to fetch work items first."
      }]
    };
  }

  // Validate workItem has required properties
  if (!workItem.WorkItemBranch || !workItem.TargetBranch || !workItem.SourceCodeRepository?.repoUrl) {
    return {
      content: [{
        type: "text",
        text: "Error: Work item is missing required properties (WorkItemBranch, TargetBranch, or SourceCodeRepository.repoUrl)."
      }]
    };
  }

  const repoUrl = workItem.SourceCodeRepository.repoUrl;
  const workItemBranch = workItem.WorkItemBranch;
  const targetBranch = workItem.TargetBranch;
  const repoPath = localPath || undefined;

  

  try {
    return {
      content: [{
        type: "text",
        text: `Detect merge conflicts for work item "${workItem.name}" (branch: ${workItemBranch}) against target branch "${targetBranch}" in repo ${repoUrl} at path: ${repoPath}.

Agent execution guide (perform these steps now):

1) Prepare repository context
   - Ensure your working directory is: '${repoPath}' (use 'cd' on macOS/Windows)
   - Update refs: 'git fetch --all --prune'

2) Check out the work item branch
   - Run: 'git checkout ${workItemBranch}'
   - If this fails, STOP here. Report the exact error output and inform the user that the branch must exist locally. Do not create a new branch or auto-track a remote. Suggest using the checkout_devops_center_work_item tool to set up the branch, then re-run conflict detection.

3) Attempt to merge the target branch into the work item branch (for detection only)
   - Run: 'git merge --no-ff --no-edit origin/${targetBranch}' (allow failure to indicate conflicts)

4) If conflicts are reported, produce a concise, readable report:
   - List conflicted files: 'git --no-pager diff --name-only --diff-filter=U'
   - For each conflicted file:
     - Preview the conflict: 'git --no-pager diff --relative -- <file>' and/or read the file and extract the first block between '<<<<<<<', '=======', '>>>>>>>'. Limit output to ~120 lines. If binary, state 'binary file conflict'.
     - Classify the conflict (e.g., both modified, add/add, rename/delete) using 'git status --porcelain=v1' and/or 'git ls-files -u'.
     - Explain in plain language why the conflict happened, using branch names "${workItemBranch}" (current) and "${targetBranch}" (incoming). Example: "Both branches changed the same function signature differently."

5) Output format (keep it user-friendly):
   - A one-line summary: 'Conflicts found between ${workItemBranch} and ${targetBranch}'
   - A bullet list of conflicted files with conflict type
   - For each file: a brief explanation (1–2 sentences) and the excerpt with conflict markers
   - End with a clear next step: suggest calling the resolve_devops_center_merge_conflict tool to proceed

6) If no conflicts are found:
   - State clearly: 'No merge conflicts detected. It is safe to proceed with merge.'

Important constraints:
- Do NOT provide manual resolution steps and do NOT modify files. After summarizing, suggest using the resolve_devops_center_merge_conflict tool to resolve the conflicts.
- Do NOT create new branches or make commits during detection.
- Execute the git commands yourself using available tools. Present command outputs and status updates here.`,
        actionRequired: true
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: ${error}`
      }]
    };
  }
}
