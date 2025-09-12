import type { Connection } from "@salesforce/core";
import { getConnection } from "../shared/auth.js";
import { 
    computeFirstStageId, 
    fetchPipelineStages, 
    getBranchNameFromStage, 
    getPipelineIdForProject, 
    findStageById, 
    resolveTargetStageId 
} from "../shared/pipelineUtils.js";
import type { WorkItem } from "../types/WorkItem.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type ListWorkItemsInput = {
    username: string;
    project: {
        Id: string;
        Name?: string;
    };
};

export type ListWorkItemsOutput = {
    workItems: WorkItem[];
    status: string;
};

type ListWorkItemsActionOptions = {
    telemetryService?: TelemetryService;
};

export interface ListWorkItemsAction {
    exec(input: ListWorkItemsInput): Promise<ListWorkItemsOutput>;
}

export class ListWorkItemsActionImpl implements ListWorkItemsAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: ListWorkItemsActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: ListWorkItemsInput): Promise<ListWorkItemsOutput> {
        try {
            this.telemetryService?.sendEvent("listWorkItemsStarted", {
                projectId: input.project.Id,
                username: input.username
            });

            const connection = await getConnection(input.username);
            const workItems = await this.fetchWorkItems(connection, input.project.Id);

            this.telemetryService?.sendEvent("listWorkItemsCompleted", {
                projectId: input.project.Id,
                workItemCount: workItems.length
            });

            return {
                workItems,
                status: "success"
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("listWorkItemsError", {
                projectId: input.project.Id,
                error: error.message
            });

            return {
                workItems: [],
                status: `Error: ${error.message}`
            };
        }
    }

    private async fetchWorkItems(connection: Connection, projectId: string): Promise<WorkItem[]> {
        const query = `
            SELECT
                Id,
                Name,
                Subject,
                Description,
                Status,
                AssignedToId,
                SourceCodeRepositoryBranchId,
                SourceCodeRepositoryBranch.Name,
                SourceCodeRepositoryBranch.SourceCodeRepositoryId,
                SourceCodeRepositoryBranch.SourceCodeRepository.Name,
                SourceCodeRepositoryBranch.SourceCodeRepository.RepositoryOwner,
                SourceCodeRepositoryBranch.SourceCodeRepository.Provider,
                DevopsPipelineStageId,
                DevopsProjectId
            FROM WorkItem
            WHERE DevopsProjectId = '${projectId}'
        `;
        
        const pipelineId = await getPipelineIdForProject(connection, projectId);
        
        if (!pipelineId) {
            throw new Error(`Pipeline ID not found for project: ${projectId}`);
        }
        
        const stages = await fetchPipelineStages(connection, pipelineId);
        if (!stages) {
            throw new Error(`Stages not found for pipeline: ${pipelineId}`);
        }

        const _firstStageId = computeFirstStageId(stages);

        const result = await connection.query(query);
        if (result && (result as any).records) {
            const records: any[] = (result as any).records;
            const workItems: WorkItem[] = records.map((item: any): WorkItem => {
                const repoName = item?.SourceCodeRepositoryBranch?.SourceCodeRepository?.Name;
                const repoOwner = item?.SourceCodeRepositoryBranch?.SourceCodeRepository?.RepositoryOwner;
                const provider = item?.SourceCodeRepositoryBranch?.SourceCodeRepository?.Provider;

                let repoUrl: string | undefined;
                if (provider === 'github' && repoOwner && repoName) {
                    repoUrl = `https://github.com/${repoOwner}/${repoName}`;
                }

                // Determine target stage
                const targetStageId = resolveTargetStageId(item.DevopsPipelineStageId, stages);
                const targetStage = findStageById(stages, targetStageId);
                const targetBranchName = getBranchNameFromStage(targetStage);
                const workItemBranchName = item?.SourceCodeRepositoryBranch?.Name;

                return {
                    id: item.Id,
                    name: item.Name,
                    subject: item.Subject,
                    status: item.Status,
                    owner: item.AssignedToId || 'Unknown',
                    DevopsProjectId: item.DevopsProjectId,
                    PipelineId: pipelineId,
                    PipelineStageId: item.DevopsPipelineStageId,
                    Environment: {
                        Org_Id: 'unknown',
                        Username: 'unknown',
                        IsTestEnvironment: true
                    },
                    SourceCodeRepository: repoUrl ? {
                        repoUrl,
                        repoType: provider || 'github'
                    } : undefined,
                    WorkItemBranch: workItemBranchName,
                    TargetStageId: targetStageId,
                    TargetBranch: targetBranchName
                };
            });

            return workItems;
        } else {
            return [];
        }
    }
}
