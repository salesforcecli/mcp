import axios from 'axios';
import { getConnection, getRequiredOrgs } from './shared/auth.js';
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { normalizeAndValidateRepoPath } from './shared/pathUtils.js';

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
    const files: Array<any> = Array.isArray(result?.files) ? result.files : [];
    const successes: Array<any> = Array.isArray(result?.details?.componentSuccesses) ? result.details.componentSuccesses : [];

    if (false && files.length === 0 && successes.length === 0) {
        throw new Error('Deployment returned no component details. Ensure there are changes under force-app.');
    }

    const compIndex: Map<string, { type: string; fullName: string; states: Set<string>; filePaths: Set<string> }> = new Map();
    const compKey = (t?: string, n?: string) => `${String(t || '').trim()}#${String(n || '').trim()}`;
    const addEntry = (type?: string, fullName?: string, state?: string, filePath?: string) => {
        if (!type || !fullName) return;
        const k = compKey(type, fullName);
        if (!compIndex.has(k)) compIndex.set(k, { type, fullName, states: new Set<string>(), filePaths: new Set<string>() });
        const entry = compIndex.get(k)!;
        if (state) entry.states.add(String(state));
        if (filePath) entry.filePaths.add(path.isAbsolute(filePath) ? filePath : path.resolve(workingDir, filePath));
    };
    for (const f of files) addEntry(f?.type, f?.fullName, f?.state, f?.filePath);
    for (const s of successes) addEntry(s?.componentType, s?.fullName, s?.created ? 'Created' : (s?.changed ? 'Changed' : 'Unchanged'), undefined);

    const deletedRel = execFileSync('git', ['ls-files', '-d'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);
    const modifiedRel = execFileSync('git', ['ls-files', '-m'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);
    const untrackedRel = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);

    const deletedAbs = new Set<string>(deletedRel.map(rel => path.resolve(workingDir, rel)));
    const modifiedAbs = new Set<string>(modifiedRel.map(rel => path.resolve(workingDir, rel)));
    const untrackedAbs = new Set<string>(untrackedRel.map(rel => path.resolve(workingDir, rel)));

    const computedChanges: Change[] = [];
    for (const { type, fullName, states, filePaths } of compIndex.values()) {
        let operation: 'delete' | 'add' | 'modify' | undefined;
        for (const p of filePaths) { if (deletedAbs.has(p)) { operation = 'delete'; break; } }
        if (!operation) {
            for (const p of filePaths) { if (untrackedAbs.has(p)) { operation = 'add'; break; } }
        }
        if (!operation) {
            for (const p of filePaths) { if (modifiedAbs.has(p)) { operation = 'modify'; break; } }
        }
        if (!operation) {
            const hasCreated = Array.from(states).some(s => String(s).toLowerCase() === 'created');
            const hasChanged = Array.from(states).some(s => String(s).toLowerCase() === 'changed');
            if (hasCreated) operation = 'add';
            else if (hasChanged) operation = 'modify';
            else operation = 'modify';
        }
        computedChanges.push({ fullName, type, operation });
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
