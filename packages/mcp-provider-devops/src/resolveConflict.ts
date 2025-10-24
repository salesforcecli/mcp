import type { WorkItem } from './types/WorkItem.js';

export interface ResolveConflictParams {
  workItem?: WorkItem;
  localPath?: string;
}


export async function resolveConflict({
  workItem,
  localPath
}: ResolveConflictParams): Promise<{ content: ({ type: "text"; text: string; [x: string]: unknown })[] }> {
  
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
  const repoPath = localPath || process.cwd();

  try {
    return {
      content: [{
        type: "text",
        text: `Resolve merge conflicts for work item "${workItem.name}" (branch: ${workItemBranch}) against target branch "${targetBranch}" in repo ${repoUrl} at path: ${repoPath}.

Agent execution guide (perform these steps now):

1) Preconditions
   - Verify your current working directory equals '${repoPath}'. Do not change directories automatically. If it does not match, STOP and report the mismatch; ask the user to navigate to '${repoPath}' or re-run with the correct localPath.
   - Verify current branch: 'git rev-parse --abbrev-ref HEAD'. If not '${workItemBranch}', run: 'git checkout ${workItemBranch}'. If checkout fails, STOP here, report the exact error, and ask the user to use the checkout_devops_center_work_item tool to set up the branch. Do not create a new branch.

2) Confirm a conflicted state
   - List conflicted files: 'git --no-pager diff --name-only --diff-filter=U'. If this returns no files, state clearly: 'No merge conflicts remain to resolve.' and stop.
   - Optionally, also run: 'git status --porcelain=v1' and show lines with 'U' or conflict indicators for context.

3) Resolve each conflicted file (no re-explanation needed)
   - For each file, ask the user to choose one option, then apply it:
     - Keep current (${workItemBranch}): 'git checkout --ours -- "<file>"'
     - Keep incoming (${targetBranch}): 'git checkout --theirs -- "<file>"'
   - After applying the user's choice, stage the file: 'git add -- "<file>"'
   - Do not proceed without explicit user choice for each file.

5) Finalize the resolution
   - Verify no conflicts remain: 'git --no-pager diff --name-only --diff-filter=U' (should be empty).
   - Commit locally: 'git commit -m "Resolve merge conflicts between ${workItemBranch} and ${targetBranch}"'. If nothing to commit, report that the index is clean.
   - Push the changes to the remote branch: 'git push origin ${workItemBranch}'

Important constraints:
- Do NOT push changes. Keep all operations local.
- Do NOT create new branches.
- Do NOT attempt a 'keep both' manual merge in this tool; only the two options above are supported.
- Use cross-platform commands (work on macOS and Windows). Avoid shell pipes and non-portable constructs.
- Execute git commands yourself using available tools and present outputs and status updates here. Always get explicit user confirmation for each per-file resolution.`,
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
