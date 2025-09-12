// import path from "path";
import { exec } from "child_process";

export interface PushWorkitemBranchChangesParams {
  repoPath: string;
  branchName: string;
  commitMessage?: string;
}

export async function pushWorkitemBranchChanges({
  repoPath,
  branchName,
  commitMessage = "Work on workitem branch"
}: PushWorkitemBranchChangesParams): Promise<{ content: ({ type: "text"; text: string; [x: string]: unknown })[] }> {
  // List changes
  function execPromise(cmd: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      exec(cmd, { cwd }, (err, stdout, stderr) => {
        resolve({ stdout, stderr });
      });
    });
  }

  // 1. git status --porcelain
  const status = await execPromise("git status --porcelain", repoPath);
  if (!status.stdout.trim()) {
    return {
      content: [{
        type: "text",
        text: `No changes to push in branch '${branchName}' for repo at ${repoPath}.`
      }]
    };
  }

  // 2. git add .
  await execPromise("git add .", repoPath);

  // 3. git commit -m "..."
  const commit = await execPromise(`git commit -m "${commitMessage}"`, repoPath);
  if (commit.stderr && !commit.stdout) {
    return {
      content: [{
        type: "text",
        text: `Commit failed: ${commit.stderr}`
      }]
    };
  }

  // 4. git push origin branchName
  const push = await execPromise(`git push origin ${branchName}`, repoPath);
  if (push.stderr && !push.stdout) {
    return {
      content: [{
        type: "text",
        text: `Push failed: ${push.stderr}`
      }]
    };
  }

  // 5. List what was pushed
  return {
    content: [{
      type: "text",
      text: `Pushed the following changes to branch '${branchName}' in repo at ${repoPath}:

${status.stdout}

Commit output:
${commit.stdout}
Push output:
${push.stdout}`
    }]
  };
} 