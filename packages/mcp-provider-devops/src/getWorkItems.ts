import { getConnection } from "./shared/auth.js";
import { computeFirstStageId, fetchPipelineStages, getBranchNameFromStage, getPipelineIdForProject, findStageById, resolveTargetStageId } from "./shared/pipelineUtils.js";
import type { WorkItem } from "./types/WorkItem.js";

type ProjectStagesContext = { pipelineId: string; stages: any[]; firstStageId: string | undefined };

function buildRepositoryInfoFromItem(item: any): { repoUrl?: string; repoType?: string } {
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
    return { repoUrl, repoType };
}

async function ensureProjectStages(
    connection: any,
    cache: Map<string, ProjectStagesContext>,
    projectId: string
): Promise<ProjectStagesContext | null> {
    if (cache.has(projectId)) {
        return cache.get(projectId)!;
    }
    const pipelineId = await getPipelineIdForProject(connection, projectId);
    if (!pipelineId) {
        return null;
    }
    const stages = await fetchPipelineStages(connection, pipelineId);
    if (!stages) {
        return null;
    }
    const firstStageId = computeFirstStageId(stages);
    const ctx: ProjectStagesContext = { pipelineId, stages, firstStageId };
    cache.set(projectId, ctx);
    return ctx;
}

function mapRawItemToWorkItem(item: any, ctx: ProjectStagesContext): WorkItem {
    const { repoUrl, repoType } = buildRepositoryInfoFromItem(item);

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
        PipelineId: ctx.pipelineId
    };

    let targetStageId = resolveTargetStageId((mapped as any)?.PipelineStageId, ctx.stages);
    if (!targetStageId) {
        targetStageId = ctx.firstStageId;
    }

    const targetStage = findStageById(ctx.stages, targetStageId);
    mapped.TargetBranch = getBranchNameFromStage(targetStage);
    mapped.TargetStageId = targetStageId;

    return mapped;
}

export async function fetchWorkItems(username: string, projectId: string): Promise<WorkItem[] | any> {
    try {
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

        let firstStageId = computeFirstStageId(stages);

        const result = await connection.query(query);
        if (result && (result as any).records) {
            const records: any[] = (result as any).records;
            const ctx: ProjectStagesContext = { pipelineId, stages, firstStageId };
            const workItems: WorkItem[] = records.map((item: any): WorkItem => mapRawItemToWorkItem(item, ctx));
            return workItems;
        }
        return [];
    } catch (error) {
        throw error;
    }
}

export async function fetchWorkItemByName(username: string, workItemName: string): Promise<WorkItem | null | any> {
    try {
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
            WHERE Name = '${workItemName}'
            LIMIT 1
        `;

        const result: any = await connection.query(query);
        const item = (result?.records || [])[0];
        if (!item) {
            return null;
        }

        const projectId: string = item?.DevopsProjectId;
        const cache = new Map<string, ProjectStagesContext>();
        const ctx = await ensureProjectStages(connection, cache, projectId);
        if (!ctx) {
            throw new Error(`Pipeline or stages not found for project: ${projectId}`);
        }
        return mapRawItemToWorkItem(item, ctx);
    } catch (error) {
        throw error;
    }
}

export async function fetchWorkItemsByNames(username: string, workItemNames: string[]): Promise<WorkItem[] | any> {
    try {
        if (!Array.isArray(workItemNames) || workItemNames.length === 0) {
            return [];
        }

        
        const escapeName = (name: string) => String(name).replace(/'/g, "\\'");
        const namesList = workItemNames.map(n => `'${escapeName(n)}'`).join(", ");

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
            WHERE Name IN (${namesList})
        `;
        const result: any = await connection.query(query);
        const records: any[] = result?.records || [];

        const projectStagesCache = new Map<string, ProjectStagesContext>();

        const workItems: WorkItem[] = [];

        for (const item of records) {
            const projectId: string = item?.DevopsProjectId;
            if (!projectId) {
                continue;
            }

            let ctx = projectStagesCache.get(projectId);
            if (!ctx) {
                const ensured = await ensureProjectStages(connection, projectStagesCache, projectId);
                if (!ensured) {
                    continue;
                }
                ctx = ensured;
            }

            const mapped = mapRawItemToWorkItem(item, ctx);
            workItems.push(mapped);
        }

        return workItems;
    } catch (error) {
        throw error;
    }
}
