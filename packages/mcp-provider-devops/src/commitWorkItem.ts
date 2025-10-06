import axios from 'axios';
import { getConnection, getRequiredOrgs } from './shared/auth.js';
import { execFileSync } from 'child_process';
import { normalizeAndValidateRepoPath } from './shared/pathUtils.js';
import path from 'path';

interface Change {
    fullName: string;
    type: string;
    operation: string;
}

interface CommitWorkItemParams {
    workItem: { id: string };
    requestId: string;
    commitMessage: string;
    doceHubUsername: string;
    sandboxUsername: string;
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
    workItem,
    requestId,
    commitMessage,
    doceHubUsername,
    sandboxUsername,
    repoPath
}: CommitWorkItemParams): Promise<any> {
    const { doceHub, sandbox, error } = await getRequiredOrgs(doceHubUsername, sandboxUsername);

    if (error || !doceHub || !sandbox || !doceHub.username || !sandbox.username) {
        throw new Error(`Dual org detection failed: ${error || 'DevOps Center and Sandbox orgs required'}. Please ensure you are logged into both DevOps Center org (for authentication) and Sandbox org (for changes).`);
    }

    const doceHubConnection = await getConnection(doceHub.username);
    if (!doceHubConnection.accessToken || !doceHubConnection.instanceUrl) {
        throw new Error('Missing DevOps Center org access token or instance URL. Please check DevOps Center org authentication.');
    }

    const sandboxConnection = await getConnection(sandbox.username);
    if (!sandboxConnection.accessToken || !sandboxConnection.instanceUrl) {
        throw new Error('Missing Sandbox org access token or instance URL. Please check Sandbox org authentication.');
    }

    const authToken = doceHubConnection.accessToken;
    const apiInstanceUrl = doceHubConnection.instanceUrl;
    const sandboxToken = sandboxConnection.accessToken;
    const sandboxInstanceUrl = sandboxConnection.instanceUrl;

    const workingDir = normalizeAndValidateRepoPath(repoPath);
    let deployJson: any;
    try {
        const out = execFileSync(
            'sf',
            ['project', 'deploy', 'report', '--use-most-recent', '--target-org', sandbox.username, '--json'],
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

    const url = `${apiInstanceUrl}/services/data/v65.0/connect/devops/workItems/${workItem.id}/commit`;

    const headers = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'token': sandboxToken,
        'instance-url': sandboxInstanceUrl
    };

    const requestBody = {
        requestId,
        commitMessage,
        changes: computedChanges
    };

    try {
        const response = await axios.post(url, requestBody, { headers });

        return {
            success: true,
            commitResult: response.data,
            message: 'Work item committed successfully',
            trace: {
                doceHubOrg: doceHub.username,
                workItemId: workItem.id,
                requestId,
                commitMessage,
                changesCount: computedChanges.length
            }
        };
    } catch (error: any) {
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`Failed to commit work item: ${errorMessage}`);
    }
}