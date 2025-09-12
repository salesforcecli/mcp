import axios from 'axios';
import { getConnection } from '../../shared/auth.js';

interface CreatePullRequestParams {
    workItemId: string;
    username: string;
}

export async function createPullRequest({
    workItemId,
    username
}: CreatePullRequestParams): Promise<any> {
    if (!workItemId) {
        throw new Error('Work item ID is required to create pull request.');
    }

    if (!username) {
        throw new Error('Salesforce username is required to create pull request.');
    }

    try {
        const connection = await getConnection(username);
        const accessToken = connection.accessToken;
        const instanceUrl = connection.instanceUrl;

        if (!accessToken || !instanceUrl) {
            throw new Error('Missing access token or instance URL. Please check if you are authenticated to the org.');
        }

        const apiVersion = 'v65.0';
        const url = `${instanceUrl}/services/data/${apiVersion}/connect/devops/workItems/${workItemId}/review`;

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        const requestBody = {};

        console.log(`Creating pull request for work item ${workItemId}...`);

        const response = await axios.post(url, requestBody, { headers });
        
        console.log(`✅ Pull request created successfully for work item ${workItemId}`);
        
        return {
            success: true,
            pullRequestResult: response.data,
            message: 'Pull request created successfully',
            workItemId
        };
    } catch (error: Error | any) {
        console.error(`❌ Failed to create pull request for work item ${workItemId}:`, error.message);
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`Failed to create pull request: ${errorMessage}`);
    }
}