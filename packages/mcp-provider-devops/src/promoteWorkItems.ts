import { type Connection } from '@salesforce/core';

const API_VERSION = 'v65.0';

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

/**
 * Promotes work items to the next pipeline stage using the provided Connection.
 */
export async function promoteWorkItems(connection: Connection, request: PromoteWorkItemsRequest): Promise<PromoteWorkItemsResponse> {
    const { workitems } = request;

    const uniqueStageIds = Array.from(new Set(workitems.map(w => w.PipelineStageId).filter(Boolean)));
    const allWorkItemsInStage = uniqueStageIds.length === 1;

    const pipelineId = workitems[0].PipelineId;
    const targetStageId = workitems[0].TargetStageId;

    const body = {
        workitemIds: workitems.map(w => w.id),
        targetStageId,
        allWorkItemsInStage,
        isCheckDeploy: false,
        deployOptions: { testLevel: "NoTestRun", isFullDeploy: false }
    };
    const path = `/services/data/${API_VERSION}/connect/devops/pipelines/${pipelineId}/promote`;
    try {
        const response = await connection.request({
            method: 'POST',
            url: path,
            body: JSON.stringify(body),
            headers: { 'Content-Type': 'application/json' }
        });
        return (response as Record<string, unknown>) ?? {};
    } catch (error: any) {
        const data = error.response?.data ?? error.body ?? error;
        return {
            error: {
                message: error.message ?? 'Unknown error',
                ...(typeof data === 'object' && data ? { details: data } : {}),
                status: error.response?.status,
                statusText: error.response?.statusText,
                url: path,
                requestBody: body
            }
        };
    }
}
