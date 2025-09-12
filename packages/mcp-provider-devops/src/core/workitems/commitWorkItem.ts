import axios from 'axios';
import { getConnection, getRequiredOrgs } from '../../shared/auth.js';
// import type { WorkItem } from './types/WorkItem.js';

interface Change {
    fullName: string;
    type: string;
    operation: string;
}

interface CommitWorkItemParams {
    workItem: { id: string };
    requestId: string;
    commitMessage: string;
    changes: Change[];
    doceHubUsername: string;
    sandboxUsername: string;
}

export async function commitWorkItem({
    workItem,
    requestId,
    commitMessage,
    changes,
    doceHubUsername,
    sandboxUsername
}: CommitWorkItemParams): Promise<any> {
    // Detect both DevOps Center (for auth) and Sandbox (for headers) orgs
    const { doceHub, sandbox, error } = await getRequiredOrgs(doceHubUsername, sandboxUsername);
    
    if (error || !doceHub || !sandbox || !doceHub.username || !sandbox.username) {
        throw new Error(`Dual org detection failed: ${error || 'DevOps Center and Sandbox orgs required'}. Please ensure you are logged into both DevOps Center org (for authentication) and Sandbox org (for changes).`);
    }

    // Get DevOps Center org connection for API authentication
    const doceHubConnection = await getConnection(doceHub.username);
    if (!doceHubConnection.accessToken || !doceHubConnection.instanceUrl) {
        throw new Error('Missing DevOps Center org access token or instance URL. Please check DevOps Center org authentication.');
    }

    // Get Sandbox org connection for headers
    const sandboxConnection = await getConnection(sandbox.username);
    if (!sandboxConnection.accessToken || !sandboxConnection.instanceUrl) {
        throw new Error('Missing Sandbox org access token or instance URL. Please check Sandbox org authentication.');
    }

    // Use DevOps Center org for API endpoint and authentication
    const authToken = doceHubConnection.accessToken;
    const apiInstanceUrl = doceHubConnection.instanceUrl;
    
    // Use Sandbox org for commit headers
    const sandboxToken = sandboxConnection.accessToken;
    const sandboxInstanceUrl = sandboxConnection.instanceUrl;

    // Commit the work item using DevOps Center API (DevOps Center org endpoint)
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
        changes
    };

    console.log(`Committing work item ${workItem.id} with ${changes.length} changes...`);

    try {
        const response = await axios.post(url, requestBody, { headers });
        console.log(`✅ Work item ${workItem.id} committed successfully`);
        
                        return {
                    success: true,
                    commitResult: response.data,
                    message: 'Work item committed successfully',
                    trace: {
                        doceHubOrg: doceHub.username,
                        workItemId: workItem.id,
                        requestId,
                        commitMessage,
                        changesCount: changes.length
                    }
                };
    } catch (error: Error | any) {
        const errorMessage = error.response?.data?.message || error.message;
        console.error(` Failed to commit work item ${workItem.id}: ${errorMessage}`);
        throw new Error(`Failed to commit work item: ${errorMessage}`);
    }
}
