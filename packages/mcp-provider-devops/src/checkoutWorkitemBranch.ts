import path from "path";
import { exec } from "child_process";

export interface PushWorkitemBranchChangesParams {
  repoPath: string;
  branchName: string;
  commitMessage?: string;
}

export async function checkoutWorkitemBranch(
  { repoUrl, branchName, localPath }: { repoUrl: string; branchName: string; localPath?: string }
): Promise<{ content: ({ type: "text"; text: string; [x: string]: unknown })[] }> {
  const fs = require('fs');
  const isGitRepo = fs.existsSync(path.join(process.cwd(), '.git'));
  let targetPath = localPath || process.cwd();

  if (!localPath && isGitRepo) {
    return {
      content: [{
        type: "text",
        text: "You are currently inside a git repository. Please specify a different directory (localPath) to clone the new repository."
      }]
    };
  }

  const repoName = (repoUrl.split('/').pop() || '').replace(/\.git$/, '');
  const repoPath = targetPath;

  function execPromise(cmd: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve) => {
      exec(cmd, { cwd }, (err, stdout, stderr) => {
        resolve({ stdout, stderr });
      });
    });
  }

  async function fetchAndCheckoutBranch(): Promise<{ content: ({ type: "text"; text: string; [x: string]: unknown })[] }> {
    const status = await execPromise('git status --porcelain', repoPath);
    if (status.stdout.trim().length > 0) {
      return {
        content: [{
          type: "text",
          text: `You have uncommitted changes in your working directory. Please commit or clean your local changes before checking out another branch.`
        }]
      };
    }
    await execPromise('git fetch origin', repoPath);
    const branchList = await execPromise('git branch --list', repoPath);
    const branchExists = branchList.stdout.split('\n').some(b => b.replace('*', '').trim() === branchName);
    if (!branchExists) {
      const checkout = await execPromise(`git checkout -b ${branchName} origin/${branchName}`, repoPath);
      if (checkout.stderr && !checkout.stdout) {
        return {
          content: [{
            type: "text",
            text: `Fetched remote, but failed to checkout branch '${branchName}': ${checkout.stderr}`
          }]
        };
      }
      return {
        content: [{
          type: "text",
          text: `Fetched remote and checked out new branch '${branchName}' from origin/${branchName}.\n${checkout.stdout}`
        }]
      };
    } else {
      const checkout = await execPromise(`git checkout ${branchName}`, repoPath);
      if (checkout.stderr && !checkout.stdout) {
        return {
          content: [{
            type: "text",
            text: `Fetched remote, but failed to checkout branch '${branchName}': ${checkout.stderr}`
          }]
        };
      }
      const pull = await execPromise(`git pull`, repoPath);
      if (pull.stderr && !pull.stdout) {
        return {
          content: [{
            type: "text",
            text: `Checked out branch '${branchName}', but failed to pull latest changes: ${pull.stderr}`
          }]
        };
      }
      return {
        content: [{
          type: "text",
          text: `Fetched remote, checked out existing branch '${branchName}', and pulled latest changes.\n${checkout.stdout}\n${pull.stdout}`
        }]
      };
    }
  }

  if (!fs.existsSync(repoPath)) {
    return {
      content: [{
        type: "text",
        text: `The repository does not exist at the provided path: ${repoPath}. Please provide the correct repoPath or clone the repository first.`
      }]
    };
  }

  if (!fs.existsSync(path.join(repoPath, '.git'))) {
    return {
      content: [{
        type: "text",
        text: `The directory at ${repoPath} is not a git repository.`
      }]
    };
  }

  const remoteCheck = await execPromise('git remote get-url origin', repoPath);
  if (!remoteCheck.stdout.trim().includes(repoUrl)) {
    return {
      content: [{
        type: "text",
        text: `The repository at ${repoPath} does not match the provided repoUrl. Found remote: ${remoteCheck.stdout.trim()}`
      }]
    };
  }

  return fetchAndCheckoutBranch();
}
