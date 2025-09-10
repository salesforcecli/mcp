import { getConnection } from "../../shared/auth.js";
import { computeFirstStageId, fetchPipelineStages, getBranchNameFromStage, getPipelineIdForProject, findStageById, resolveTargetStageId } from "../../shared/pipelineUtils.js";
import type { WorkItem } from "../../types/WorkItem.js";

export async function fetchWorkItems(username: string, projectId: string): Promise<WorkItem[] | any> {
    try {
        //console.log(`Getting work items for project: ${projectId} on instance: ${username}`);
        const connection = await getConnection(username);
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

        const firstStageId = computeFirstStageId(stages);


        const result = await connection.query(query);
        if (result && (result as any).records) {
            const records: any[] = (result as any).records;
            const workItems: WorkItem[] = records.map((item: any): WorkItem => {
                const repoName = item?.SourceCodeRepositoryBranch?.SourceCodeRepository?.Name;
                const repoOwner = item?.SourceCodeRepositoryBranch?.SourceCodeRepository?.RepositoryOwner;
                const provider = item?.SourceCodeRepositoryBranch?.SourceCodeRepository?.Provider;

                let repoUrl: string | undefined;
                let repoType: string | undefined;
                if (provider && repoOwner && repoName) {
                    const normalizedProvider = String(provider).toLowerCase();
                    repoType = normalizedProvider;
                    if (normalizedProvider === "github") {
                        repoUrl = `https://github.com/${repoOwner}/${repoName}`;
                    }
                }

                const mapped: WorkItem = {
                    id: item?.Id,
                    name: item?.Name || "",
                    subject: item?.Subject || undefined,
                    status: item?.Status || "",
                    owner: item?.AssignedToId || "",
                    SourceCodeRepository: repoUrl || repoType ? {
                        repoUrl: repoUrl || "",
                        repoType: repoType || ""
                    } : undefined,
                    WorkItemBranch: item?.SourceCodeRepositoryBranch?.Name || undefined,
                    PipelineStageId: item?.DevopsPipelineStageId || undefined,
                    DevopsProjectId: item?.DevopsProjectId,
                    PipelineId: pipelineId
                };

                let targetStageId = resolveTargetStageId((mapped as any)?.PipelineStageId, stages);
                if (!targetStageId) {
                  targetStageId = firstStageId
                }
            
                const targetStage = findStageById(stages, targetStageId);
                mapped.TargetBranch  = getBranchNameFromStage(targetStage);
                mapped.TargetStageId = targetStageId;

                return mapped;
            });
            return workItems;
        }
        return [];
    } catch (error) {
        return error;
    }
}

