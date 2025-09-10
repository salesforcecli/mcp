import axios from 'axios';
import { getConnection } from '../../shared/auth.js';

interface GetChangesParams {
    username: string;
    offset?: number;
    limit?: number;
}

export async function getChanges({
    username,
    offset = 0,
    limit = 30
}: GetChangesParams): Promise<any> {
    if (!username) {
        throw new Error('Salesforce username is required. Please provide a username.');
    }

    try {
        const connection = await getConnection(username);
        const accessToken = connection.accessToken;
        const instanceUrl = connection.instanceUrl;

        if (!accessToken || !instanceUrl) {
            throw new Error('Missing access token or instance URL. Please check if you are using the correct org to get changes.');
        }

        const apiVersion = 'v65.0';
        const url = `${instanceUrl}/services/data/${apiVersion}/connect/devops/getChanges`;
        
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        const params = {
            offset,
            limit
        };

        const response = await axios.get(url, { headers, params });
        return response.data;
    } catch (error: Error | any) {
        console.error('Error fetching changes:', error.message);
        const errorMessage = error.response?.data?.message || error.message;
        throw new Error(`Failed to get changes: ${errorMessage}`);
    }
}
