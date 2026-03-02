import { type Connection } from '@salesforce/core';
import { execFileSync } from 'child_process';
import { normalizeAndValidateRepoPath } from './shared/pathUtils.js';
import path from 'path';

const API_VERSION = 'v65.0';

interface Change {
    fullName: string;
    type: string;
    operation: string;
}

export interface CommitWorkItemParams {
    devHubConnection: Connection;
    sandboxConnection: Connection;
    /** Sandbox org username for CLI (e.g. sf project deploy report --target-org). */
    sandboxUsername: string;
    workItem: { id: string };
    requestId: string;
    commitMessage: string;
    repoPath?: string;
}



function normalizeGitPath(gitPath: string): string {
    let rel = gitPath.replace(/^force-app[\\/]+main[\\/]+default[\\/]+/, '');
    rel = rel.replace(/-meta\.xml$/, '');
    return rel;
}

function normalizeDeployFile(fileName: string): string {
    return fileName.trim();
}

function isMatch(deployFile: string, gitPath: string): boolean {
    const normGit = normalizeGitPath(gitPath);      // e.g. objects/HourlyForecast__c/HourlyForecast__c.object
    const normDeploy = normalizeDeployFile(deployFile); // e.g. objects/HourlyForecast__c.object

    // direct match (Apex, layouts, etc.)
    if (normGit === normDeploy) return true;

    // fallback: compare by folder + last segment
    // objects/HourlyForecast__c/HourlyForecast__c.object  → split parts
    const gitParts = normGit.split('/');
    const deployParts = normDeploy.split('/');

    if (gitParts.length > 1 && deployParts.length > 1) {
        // compare folder name and file name only
        const gitFolder = gitParts[0];
        const gitFile = gitParts[gitParts.length - 1];
        const deployFolder = deployParts[0];
        const deployFile = deployParts[deployParts.length - 1];

        if (gitFolder === deployFolder && gitFile === deployFile) {
            return true;
        }
    }

    return false;
}

export async function commitWorkItem({
    devHubConnection,
    sandboxConnection,
    sandboxUsername,
    workItem,
    requestId,
    commitMessage,
    repoPath
}: CommitWorkItemParams): Promise<any> {
    const sandboxToken = sandboxConnection.accessToken;
    const sandboxInstanceUrl = sandboxConnection.instanceUrl;
    if (!sandboxToken || !sandboxInstanceUrl) {
        throw new Error('Missing Sandbox org access token or instance URL. Please check Sandbox org authentication.');
    }

    const workingDir = normalizeAndValidateRepoPath(repoPath);
    let deployJson: any;
    try {
        const out = execFileSync(
            'sf',
            ['project', 'deploy', 'report', '--use-most-recent', '--target-org', sandboxUsername, '--json'],
            { cwd: workingDir, encoding: 'utf8' }
        );
        deployJson = JSON.parse(out);
    } catch (e: any) {
        throw new Error(`Deployment failed or output unparsable. Ensure repoPath is a valid SFDX project and CLI is authenticated. Details: ${e?.message || e}`);
    }

    const result = deployJson?.result || {};
    const successes: Array<any> = Array.isArray(result?.details?.componentSuccesses) ? result.details.componentSuccesses : [];

    if (successes.length === 0) {
        throw new Error('Deployment returned no component details. Ensure there are changes under force-app.');
    }

    const deletedRel = execFileSync('git', ['ls-files', '-d'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);
    const modifiedRel = execFileSync('git', ['ls-files', '-m'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);
    const untrackedRel = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);
    const stagedRel = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);


    
    const computedChanges: Change[] = [];
    
    
    for (const { componentType, fullName, fileName } of successes.values()) {
        let operation: 'delete' | 'add' | 'modify' | undefined;
    
        const isDeleted = deletedRel.some(p => isMatch(fileName, p));
        if (!operation && isDeleted) operation = 'delete';
    
        if (!operation) {
            const isUntracked = untrackedRel.some(p => isMatch(fileName, p));
            if (isUntracked) operation = 'add';
        }
    
        if (!operation) {
            const isModified = modifiedRel.some(p => isMatch(fileName, p));
            if (isModified) operation = 'modify';
        }
    
        if (!operation) {
            const isStaged = stagedRel.some(p => isMatch(fileName, p));
            if (isStaged) operation = 'modify';
        }
    
        if (operation && componentType) {
            computedChanges.push({ fullName, type: componentType, operation });
        }
    }

        
    if (computedChanges.length === 0) {
        throw new Error('No eligible changes to commit (only Unchanged components detected).');
    }

    const pathUrl = `/services/data/${API_VERSION}/connect/devops/workItems/${workItem.id}/commit`;
    const requestBody = {
        requestId,
        commitMessage,
        changes: computedChanges
    };

    try {
        const response = await devHubConnection.request({
            method: 'POST',
            url: pathUrl,
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
                'token': sandboxToken,
                'instance-url': sandboxInstanceUrl
            }
        });
        return {
            success: true,
            commitResult: response ?? {},
            message: 'Work item committed successfully',
            trace: {
                workItemId: workItem.id,
                requestId,
                commitMessage,
                changesCount: computedChanges.length
            }
        };
    } catch (error: any) {
        const data = error.response?.data ?? error.body ?? error;
        const errorMessage = (typeof data === 'object' && data?.message) || error.message;
        throw new Error(`Failed to commit work item: ${errorMessage}`);
    }
}