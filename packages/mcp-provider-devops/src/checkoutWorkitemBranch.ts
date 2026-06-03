import { isGitRepository, hasUncommittedChanges, getCurrentBranch, validateGitBranchName } from './shared/gitUtils.js';

export interface PushWorkitemBranchChangesParams {
  repoPath: string;
  branchName: string;
  commitMessage?: string;
}

/**
 * Shell-escapes a validated branch name for safe inclusion in command strings.
 * Only use after validateGitBranchName has been called.
 */
function shellEscape(value: string): string {
  // Single quotes prevent all expansion and substitution
  // Escape any single quotes by ending the quoted string, adding an escaped quote, and starting a new quoted string
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export async function checkoutWorkitemBranch(
  { repoUrl, branchName, localPath }: { repoUrl: string; branchName: string; localPath?: string }
): Promise<{ content: ({ type: "text"; text: string; [x: string]: unknown })[]; isError?: boolean }> {
  // shared helpers used

  if (!repoUrl || !branchName) {
    return {
      content: [{
        type: "text",
        text: "Error: Missing required parameters. 'repoUrl' and 'branchName' are mandatory."
      }],
      isError: true
    };
  }

  if (!localPath || localPath.trim().length === 0) {
    return {
      content: [{
        type: "text",
        text: "Error: 'localPath' is required and must point to the git repository root."
      }],
      isError: true
    };
  }

  // Validate branch name to prevent command injection
  let validatedBranchName: string;
  try {
    validatedBranchName = validateGitBranchName(branchName);
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error: Invalid branch name '${branchName}'. ${error instanceof Error ? error.message : 'Branch name validation failed.'}`
      }],
      isError: true
    };
  }

  if (!isGitRepository(localPath)) {
    return {
      content: [{
        type: "text",
        text: `Error: '${localPath}' is not a Git repository. Please provide the correct project path (repo root containing a .git directory). Cloning is not performed by this tool.`
      }],
      isError: true
    };
  }

  if (hasUncommittedChanges(localPath)) {
    const currentBranch = getCurrentBranch(localPath);
    return {
      content: [{
        type: "text",
        text: `Error: '${localPath}' has uncommitted changes.${currentBranch ? ` Current branch is '${currentBranch}'.` : ""} Resolve this on the current branch first (commit or stash), then retry checkout for '${validatedBranchName}'. Do not commit those pending changes to '${validatedBranchName}' before switching.`
      }],
      isError: true
    };
  }

  // Shell-escape the validated branch name for safe inclusion in command strings
  const escapedBranch = shellEscape(validatedBranchName);

  return {
    content: [{
      type: "text",
      text: `Checkout work item branch '${validatedBranchName}' without cloning.

      Context:
      - Work item branch: ${validatedBranchName}
      - Local path: '${localPath}'

        Agent execution guide (perform these steps now):

          1) Prepare repository context
            - Update refs (focused): git fetch origin ${escapedBranch} --prune

          2) Verify remote branch exists
            - Run: git ls-remote --exit-code --heads origin ${escapedBranch}
            - If this fails, STOP and report the error. Do not create a new branch.

          3) Check out the work item branch
            - Try local checkout: git checkout ${escapedBranch}
            - If branch is not local, track remote: git checkout -t origin/${escapedBranch}
            - Confirm current branch: git rev-parse --abbrev-ref HEAD  (should print '${validatedBranchName}')

          4) Ensure latest changes are present
            - Run: git pull --ff-only

          5) Output format
            - Provide a concise confirmation message with the final path and branch name, e.g.:
              'Checked out ${validatedBranchName} at '${localPath}'. Ready for development.'

          Important constraints:
          - Do NOT create new branches or force-push.
          - Do NOT modify files. Only perform the minimal git operations above.
          - If any command fails, STOP and surface the exact stderr, then suggest the user validate the repo URL, access, and branch name or re-run with a correct path.`,
      actionRequired: true
    }]
  };
}
