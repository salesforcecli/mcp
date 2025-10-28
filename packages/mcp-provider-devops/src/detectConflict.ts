import type { WorkItem } from './types/WorkItem.js';
import { isGitRepository, hasUncommittedChanges } from './shared/gitUtils.js';
import { validateLocalGitState, validateWorkItemPresence, validateWorkItemFields, validateLocalRepoMatchesWorkItemRepo } from './shared/validation.js';

export interface DetectConflictParams {
  workItem?: WorkItem;
  localPath?: string;
}

// moved to shared/gitUtils

function validateDetectConflictInputs({ workItem, localPath }: DetectConflictParams):
  | { error: { content: ({ type: "text"; text: string; [x: string]: unknown })[] } }
  | { ok: true; workItem: WorkItem; localPath?: string } {
  const localStateError = validateLocalGitState(localPath);
  if (localStateError) {
    return { error: localStateError };
  }

  const wiPresenceError = validateWorkItemPresence(workItem as WorkItem);
  if (wiPresenceError) {
    return { error: wiPresenceError };
  }

  const wiFieldsError = validateWorkItemFields(workItem as WorkItem);
  if (wiFieldsError) {
    return { error: wiFieldsError };
  }

  const repoMatchError = validateLocalRepoMatchesWorkItemRepo(workItem as WorkItem, localPath);
  if (repoMatchError) {
    return { error: repoMatchError };
  }

  return { ok: true, workItem: workItem as WorkItem, localPath };
}

export async function detectConflict({
  workItem,
  localPath
}: DetectConflictParams): Promise<{ content: ({ type: "text"; text: string; [x: string]: unknown })[] }> {
  const validation = validateDetectConflictInputs({ workItem, localPath });
  if ("error" in validation) {
    return validation.error;
  }
  const ensuredWorkItem = validation.workItem;
  const ensuredLocalPath = validation.localPath;

  const repoUrl = ensuredWorkItem.SourceCodeRepository!.repoUrl;
  const workItemBranch = ensuredWorkItem.WorkItemBranch!;
  const targetBranch = ensuredWorkItem.TargetBranch!;
  const repoPath = ensuredLocalPath;

  try {
    return {
      content: [{
        type: "text",
        text: `Detect merge conflicts for work item "${ensuredWorkItem.name}" (branch: ${workItemBranch}) against target branch "${targetBranch}" in repo ${repoUrl} at path: ${repoPath}.

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
