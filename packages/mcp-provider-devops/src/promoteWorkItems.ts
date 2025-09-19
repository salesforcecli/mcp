import { getConnection } from './shared/auth.js';
import axios from 'axios';

export interface PromoteWorkItemsRequest {
    workitems: Array<{ id: string; PipelineStageId: string; TargetStageId: string, PipelineId: string }>;
}

export interface PromoteWorkItemsResponse {
    requestId?: string;
    error?: {
        message: string;
        details?: any;
        status?: number;
        statusText?: string;
        url?: string;
        requestBody?: any;
        actionRequired?: boolean;
    };
}

export async function promoteWorkItems(username: string, request: PromoteWorkItemsRequest): Promise<PromoteWorkItemsResponse> {
    const { workitems } = request;

    const connection = await getConnection(username);
    const accessToken = connection.accessToken;
    const instanceUrl = connection.instanceUrl;

    if (!accessToken || !instanceUrl) {
        throw new Error('Missing access token or instance URL.');
    }

    const uniqueStageIds = Array.from(new Set(workitems.map(w => w.PipelineStageId).filter(Boolean)));
    const allWorkItemsInStage = uniqueStageIds.length === 1;
    
    if (false && !allWorkItemsInStage) {
        throw new Error('All workitems must be in the same stage.');
    }

    const pipelineId = workitems[0].PipelineId;
    const targetStageId = workitems[0].TargetStageId;
    
    const body: any = {
        workitemIds: workitems.map(w => w.id),
        targetStageId: targetStageId,
        allWorkItemsInStage: allWorkItemsInStage,
        isCheckDeploy: false,
        deployOptions: { testLevel: "NoTestRun", isFullDeploy: true }
    };
    const url = `${instanceUrl}/services/data/v65.0/connect/devops/pipelines/${pipelineId}/promote`;
    try {
        const response = await axios.post(url, body, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        return response.data;
    } catch (error: any) {
        return {
            error: {
                message: error.message,
                ...(error.response && error.response.data ? { details: error.response.data } : {}),
                status: error.response?.status,
                statusText: error.response?.statusText,
                url,
                requestBody: body
            }
        };
    }   
}
