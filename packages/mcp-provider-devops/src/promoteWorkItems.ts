import { type Connection } from '@salesforce/core';

const API_VERSION = 'v65.0';

export interface DeployOptions {
    testLevel?: string;
    isFullDeploy?: boolean;
}

export interface PromoteWorkItemsRequest {
    workitems: Array<{ id: string; PipelineStageId: string; TargetStageId: string; PipelineId: string }>;
    /** Optional. When resolving deployment failures (e.g. missing dependency), pass isFullDeploy: true to run a full deploy. */
    deployOptions?: DeployOptions;
}

export interface PromoteWorkItemsResponse {
    requestId?: string;
    error?: {
        message: string;
        details?: unknown;
        status?: number;
        statusText?: string;
        url?: string;
        requestBody?: unknown;
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

    const defaultDeployOptions = { testLevel: "NoTestRun" as const, isFullDeploy: false };
    const deployOptions = { ...defaultDeployOptions, ...request.deployOptions };

    const body = {
        workitemIds: workitems.map(w => w.id),
        targetStageId,
        allWorkItemsInStage,
        isCheckDeploy: false,
        deployOptions
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
    } catch (error: unknown) {
        const err = error as { message?: string; response?: { data?: unknown; status?: number; statusText?: string }; body?: unknown };
        const data = err.response?.data ?? err.body ?? error;
        return {
            error: {
                message: err.message ?? 'Unknown error',
                ...(typeof data === 'object' && data ? { details: data } : {}),
                status: err.response?.status,
                statusText: err.response?.statusText,
                url: path,
                requestBody: body
            }
        };
    }
}
