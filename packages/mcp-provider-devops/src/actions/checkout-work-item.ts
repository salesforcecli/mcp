import path from "path";
import { exec } from "child_process";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type CheckoutWorkItemInput = {
    repoUrl: string;
    branchName: string;
    localPath?: string;
};

export type CheckoutWorkItemOutput = {
    success: boolean;
    message: string;
    repoPath?: string;
};

type CheckoutWorkItemActionOptions = {
    telemetryService?: TelemetryService;
};

export interface CheckoutWorkItemAction {
    exec(input: CheckoutWorkItemInput): Promise<CheckoutWorkItemOutput>;
}

export class CheckoutWorkItemActionImpl implements CheckoutWorkItemAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: CheckoutWorkItemActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: CheckoutWorkItemInput): Promise<CheckoutWorkItemOutput> {
        try {
            this.telemetryService?.sendEvent("checkoutWorkItemStarted", {
                repoUrl: input.repoUrl,
                branchName: input.branchName
            });

            const result = await this.checkoutWorkitemBranch(input);

            this.telemetryService?.sendEvent("checkoutWorkItemCompleted", {
                success: result.success,
                repoPath: result.repoPath
            });

            return result;
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("checkoutWorkItemError", {
                error: error.message
            });

            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    }

    private async checkoutWorkitemBranch(
        { repoUrl, branchName, localPath }: CheckoutWorkItemInput
    ): Promise<CheckoutWorkItemOutput> {
        const fs = await import('fs');
        const isGitRepo = fs.existsSync(path.join(process.cwd(), '.git'));
        const targetPath = localPath || process.cwd();

        if (!localPath && isGitRepo) {
            return {
                success: false,
                message: "You are currently inside a git repository. Please specify a different directory (localPath) to clone the new repository."
            };
        }

        const repoPath = targetPath;

        const execPromise = (cmd: string, cwd: string): Promise<{ stdout: string; stderr: string }> => {
            return new Promise((resolve) => {
                exec(cmd, { cwd }, (err, stdout, stderr) => {
                    resolve({ stdout, stderr });
                });
            });
        };

        // Check for uncommitted changes
        if (fs.existsSync(path.join(repoPath, '.git'))) {
            const status = await execPromise('git status --porcelain', repoPath);
            if (status.stdout.trim().length > 0) {
                return {
                    success: false,
                    message: `You have uncommitted changes in your working directory. Please commit or clean your local changes before checking out another branch.`
                };
            }
        }

        // Fetch all remote branches if repo exists
        if (fs.existsSync(path.join(repoPath, '.git'))) {
            await execPromise('git fetch origin', repoPath);
        } else {
            // Clone repository if it doesn't exist
            const cloneResult = await execPromise(`git clone ${repoUrl} .`, repoPath);
            if (cloneResult.stderr && cloneResult.stderr.includes('fatal:')) {
                return {
                    success: false,
                    message: `Failed to clone repository: ${cloneResult.stderr}`
                };
            }
        }

        // Check if branch exists locally
        const localBranchCheck = await execPromise(`git show-ref --verify --quiet refs/heads/${branchName}`, repoPath);
        const branchExistsLocally = !localBranchCheck.stderr;

        if (branchExistsLocally) {
            // Switch to existing local branch
            const checkoutResult = await execPromise(`git checkout ${branchName}`, repoPath);
            if (checkoutResult.stderr && checkoutResult.stderr.includes('error:')) {
                return {
                    success: false,
                    message: `Failed to checkout branch: ${checkoutResult.stderr}`
                };
            }
        } else {
            // Check if branch exists on remote
            const remoteBranchCheck = await execPromise(`git show-ref --verify --quiet refs/remotes/origin/${branchName}`, repoPath);
            const branchExistsOnRemote = !remoteBranchCheck.stderr;

            if (branchExistsOnRemote) {
                // Create and switch to new branch tracking remote
                const checkoutResult = await execPromise(`git checkout -b ${branchName} origin/${branchName}`, repoPath);
                if (checkoutResult.stderr && checkoutResult.stderr.includes('fatal:')) {
                    return {
                        success: false,
                        message: `Failed to checkout remote branch: ${checkoutResult.stderr}`
                    };
                }
            } else {
                return {
                    success: false,
                    message: `Branch ${branchName} does not exist locally or on remote.`
                };
            }
        }

        return {
            success: true,
            message: `Successfully checked out branch '${branchName}' at ${repoPath}`,
            repoPath
        };
    }
}
