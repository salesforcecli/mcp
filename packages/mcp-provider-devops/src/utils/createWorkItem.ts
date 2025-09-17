import { getConnection } from "../shared/auth.js";
import axios from "axios";

export interface CreateWorkItemRequest {
    username: string;
    subject: string;
    description: string;
    projectId: string;
}

export interface CreateWorkItemResponse {
    id?: string;
    success?: boolean;
    error?: {
        message: string;
        details?: any;
    };
}

/**
 * Creates a new work item in DevOps Center.
 */
export async function createWorkItem(request: CreateWorkItemRequest): Promise<CreateWorkItemResponse> {
    const { username, subject, description, projectId } = request;

    try {
        const connection = await getConnection(username);
        const accessToken = connection.accessToken;
        const instanceUrl = connection.instanceUrl;

        if (!accessToken || !instanceUrl) {
            throw new Error("Missing access token or instance URL.");
        }

        const url = `${instanceUrl}/services/data/v65.0/connect/devops/projects/${encodeURIComponent(projectId)}/workitem`;

        const body = {
            subject,
            description
        };

        const response = await axios.post(url, body, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });

        return {
            id: response.data?.id || response.data?.Id,
            success: true
        };
    } catch (error: any) {
        return {
            error: {
                message: 'Operation failed',
                ...(error.response && error.response.data ? { details: error.response.data } : {})
            }
        };
    }
}


