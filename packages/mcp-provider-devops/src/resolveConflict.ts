import type { WorkItem } from './types/WorkItem.js';

export interface ResolveConflictParams {
  workItem?: WorkItem;
  localPath?: string;
}

export async function resolveConflict({
  workItem,
  localPath
}: ResolveConflictParams): Promise<{ content: ({ type: "text"; text: string; [x: string]: unknown })[] }> {
  
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

1. Only if there is conflict:
   - If there are conflicts:
       - Run 'git status' to identify conflicted files
       - For each conflicted file, read and display the conflict markers
       - If not explained already: 
        - Explain the conflict in simple terms: "This conflict occurs because ${workItemBranch} and ${targetBranch} both modified the same code..."
        - Show the user the three sections in each conflicted file:
            * "Current changes" (${workItemBranch} changes)
            * "Incoming changes" (${targetBranch} changes) 
            * "Common ancestor" (the original code both branches started from)
       - For each conflicted file, ask the user to choose:
           * "Keep current changes" (${workItemBranch})
               - Use command: 'git checkout --ours <file>'
               - This accepts changes from the ${workItemBranch}
          * "Keep incoming changes" (${targetBranch})
              - Use command: 'git checkout --theirs <file>'
              - This accepts changes from the ${targetBranch}
       - IMPORTANT: Do NOT proceed with conflict resolution until the user explicitly tells you which option they want to choose for each conflicted file
       - IMPORTANT: Do NOT push the changes to the target branch (${targetBranch})

Goal:
${workItemBranch} should be conflict-free with ${targetBranch}, so it can be merged without issues.

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
