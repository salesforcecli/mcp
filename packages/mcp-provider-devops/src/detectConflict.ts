import type { WorkItem } from './types/WorkItem.js';

export interface DetectConflictParams {
  workItem?: WorkItem;
  localPath?: string;
}

export async function detectConflict({
  workItem,
  localPath
}: DetectConflictParams): Promise<{ content: ({ type: "text"; text: string; [x: string]: unknown })[] }> {
  
  if (!workItem) {
    return {
      content: [{
        type: "text",
        text: "Error: Please provide a workItem to check for conflicts. Use the list_workitems tool to fetch work items first."
      }]
    };
  }

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
        text: `Check for conflicts: for the work item — ${workItem.name} (branch: ${workItemBranch}) against target branch ${targetBranch}.

        LLM Agent Instruction:
        You must now:

        1. For work item branch (${workItemBranch}):
          - Checkout the branch: 'git checkout ${workItemBranch}'
          - Merge the target branch into your workitem branch:
              - 'git fetch origin'
              - 'git merge origin/${targetBranch}'
          - If there are conflicts:
              - Run 'git status' to identify conflicted files
              - For each conflicted file, read and display the conflict markers
              - Explain the conflict in simple terms: "This conflict occurs because ${workItemBranch} and ${targetBranch} both modified the same code..."
              - After these steps, call the resolve_conflict tool to resolve the conflicts.
        - IMPORTANT: Do not provide resolution instructions, call the resolve_conflict tool to resolve the conflicts.

Goal:
explain conflict in ${workItemBranch} with ${targetBranch} in simple langugae and call resolve_conflict tool to resolve the conflicts.

You must execute these git commands yourself using available tools, but always ask for user input when resolving conflicts. Present all results and status updates here.`,
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
