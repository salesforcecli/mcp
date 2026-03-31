import { type Connection } from "@salesforce/core";
import { computeFirstStageId, fetchPipelineStages, getBranchNameFromStage, getPipelineIdForProject, findStageById, resolveTargetStageId } from "./shared/pipelineUtils.js";
import type { WorkItem } from "./types/WorkItem.js";

type ProjectStagesContext = { pipelineId: string; stages: any[]; firstStageId: string | undefined };
type VcsType = "GITHUB" | "BITBUCKET";

const API_VERSION = "v65.0";

function normalizeProvider(provider: unknown): string | undefined {
    if (!provider) return undefined;
    const normalized = String(provider).toLowerCase();
    if (normalized === "bitbucketcloud") {
        return "bitbucket";
    }
    return normalized;
}

function providerToVcsType(provider: unknown): VcsType | undefined {
    const normalized = normalizeProvider(provider);
    if (normalized === "github") {
        return "GITHUB";
    }
    if (normalized === "bitbucket") {
        return "BITBUCKET";
    }
    return undefined;
}

function extractOwnerValue(ownerContainer: any): string | undefined {
    if (!ownerContainer || typeof ownerContainer !== "object") {
        return undefined;
    }
    const owner = ownerContainer?.owner;
    return typeof owner === "string" && owner.trim() ? owner.trim() : undefined;
}

function extractOwnerFromVcsPayload(payload: any): string | undefined {
    if (!payload) {
        return undefined;
    }

    if (typeof payload === "string") {
        return payload.trim() || undefined;
    }

    const directOwner = payload?.owner;
    if (typeof directOwner === "string" && directOwner.trim()) {
        return directOwner.trim();
    }

    const directObjectOwner = extractOwnerValue(payload?.owner);
    if (directObjectOwner) {
        return directObjectOwner;
    }

    const list =
        payload?.owners ||
        payload?.items ||
        payload?.records;
    if (Array.isArray(list)) {
        for (const candidate of list) {
            if (typeof candidate === "string" && candidate.trim()) {
                return candidate.trim();
            }
            const ownerFromCandidate = extractOwnerValue(candidate);
            if (ownerFromCandidate) {
                return ownerFromCandidate;
            }
        }
    }

    return undefined;
}

async function fetchOwnerByVcsType(connection: Connection, vcsType: VcsType): Promise<string | undefined> {
    const path = `/services/data/${API_VERSION}/connect/devops/vcs/${vcsType}`;
    const response = await (connection as any).request({
        method: "GET",
        url: path
    });
    return extractOwnerFromVcsPayload(response);
}

async function fetchVcsOwnersForRecords(connection: Connection, records: any[]): Promise<Map<string, string>> {
    const providerOwnerMap = new Map<string, string>();
    const vcsTypes = new Set<VcsType>();

    for (const item of records) {
        const provider = item?.SourceCodeRepositoryBranch?.SourceCodeRepository?.Provider;
        const vcsType = providerToVcsType(provider);
        if (vcsType) {
            vcsTypes.add(vcsType);
        }
    }

    await Promise.all(Array.from(vcsTypes).map(async (vcsType) => {
        try {
            const owner = await fetchOwnerByVcsType(connection, vcsType);
            if (!owner) {
                return;
            }
            if (vcsType === "GITHUB") {
                providerOwnerMap.set("github", owner);
            } else if (vcsType === "BITBUCKET") {
                providerOwnerMap.set("bitbucket", owner);
            }
        } catch {
            // Fall back to RepositoryOwner from work item when Connect API owner lookup fails.
        }
    }));

    return providerOwnerMap;
}

function buildRepositoryInfoFromItem(item: any, providerOwnerMap?: Map<string, string>): { repoUrl?: string; repoType?: string } {
    const repoName = item?.SourceCodeRepositoryBranch?.SourceCodeRepository?.Name;
    const provider = item?.SourceCodeRepositoryBranch?.SourceCodeRepository?.Provider;
    const normalizedProvider = normalizeProvider(provider);
    const ownerFromConnectApi = normalizedProvider ? providerOwnerMap?.get(normalizedProvider) : undefined;
    const repoOwner = ownerFromConnectApi || item?.SourceCodeRepositoryBranch?.SourceCodeRepository?.RepositoryOwner;

    let repoUrl: string | undefined;
    let repoType: string | undefined;
    if (normalizedProvider && repoOwner && repoName) {
        if (normalizedProvider === "github") {
            repoType = "github";
            repoUrl = `https://github.com/${repoOwner}/${repoName}`;
        } else if (normalizedProvider === "bitbucket") {
            // Canonicalize both provider variants to "bitbucket" for downstream consistency.
            repoType = "bitbucket";
            repoUrl = `https://bitbucket.org/${repoOwner}/${repoName}`;
        } else {
            repoType = normalizedProvider;
        }
    }
    return { repoUrl, repoType };
}

async function ensureProjectStages(
    connection: any,
    cache: Map<string, ProjectStagesContext | null>,
    projectId?: string
): Promise<ProjectStagesContext | null> {
    if (!projectId) {
        return null;
    }
    if (cache.has(projectId)) {
        return cache.get(projectId) ?? null;
    }
    const pipelineId = await getPipelineIdForProject(connection, projectId);
    if (!pipelineId) {
        cache.set(projectId, null);
        return null;
    }
    const stages = await fetchPipelineStages(connection, pipelineId);
    if (!stages?.length) {
        cache.set(projectId, null);
        return null;
    }
    const firstStageId = computeFirstStageId(stages);
    const ctx: ProjectStagesContext = { pipelineId, stages, firstStageId };
    cache.set(projectId, ctx);
    return ctx;
}

function mapRawItemToWorkItem(item: any, ctx: ProjectStagesContext | null, providerOwnerMap?: Map<string, string>): WorkItem {
    const { repoUrl, repoType } = buildRepositoryInfoFromItem(item, providerOwnerMap);

    const mapped: WorkItem = {
        id: item?.Id,
        name: item?.Name || "",
        subject: item?.Subject || undefined,
        description: item?.Description || undefined,
        status: item?.Status || "",
        owner: item?.AssignedToId || "",
        SourceCodeRepository: repoUrl || repoType ? {
            repoUrl: repoUrl || "",
            repoType: repoType || ""
        } : undefined,
        WorkItemBranch: item?.SourceCodeRepositoryBranch?.Name || undefined,
        PipelineStageId: item?.DevopsPipelineStageId || undefined,
        DevopsProjectId: item?.DevopsProjectId,
        PipelineId: ctx?.pipelineId
    };

    if (ctx) {
        let targetStageId = resolveTargetStageId((mapped as any)?.PipelineStageId, ctx.stages);
        if (!targetStageId) {
            targetStageId = ctx.firstStageId;
        }
        const targetStage = findStageById(ctx.stages, targetStageId);
        mapped.TargetBranch = getBranchNameFromStage(targetStage);
        mapped.TargetStageId = targetStageId;
    }

    return mapped;
}

export async function fetchWorkItems(connection: Connection, projectId: string): Promise<WorkItem[] | any> {
    try {
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
        
        
        const result = await connection.query(query);
        if (!result || !(result as any).records) {
            return [];
        }

        const records: any[] = (result as any).records;
        const projectStagesCache = new Map<string, ProjectStagesContext | null>();
        const ctx = await ensureProjectStages(connection, projectStagesCache, projectId);
        const providerOwnerMap = await fetchVcsOwnersForRecords(connection, records);

        const workItems: WorkItem[] = records.map((item: any): WorkItem => mapRawItemToWorkItem(item, ctx, providerOwnerMap));
        return workItems;
    } catch (error) {
        throw error;
    }
}

/**
 * Fetches a work item by name using the given Connection (e.g. from getOrgService().getConnection()).
 */
export async function fetchWorkItemByName(connection: Connection, workItemName: string): Promise<WorkItem | null | any> {
    try {
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
        const cache = new Map<string, ProjectStagesContext | null>();
        const ctx = await ensureProjectStages(connection, cache, projectId);
        const providerOwnerMap = await fetchVcsOwnersForRecords(connection, [item]);
        return mapRawItemToWorkItem(item, ctx, providerOwnerMap);
    } catch (error) {
        throw error;
    }
}

export async function fetchWorkItemsByNames(connection: Connection, workItemNames: string[]): Promise<WorkItem[] | any> {
    try {
        if (!Array.isArray(workItemNames) || workItemNames.length === 0) {
            return [];
        }

        const escapeName = (name: string) => String(name).replace(/'/g, "\\'");
        const namesList = workItemNames.map(n => `'${escapeName(n)}'`).join(", ");
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

        const projectStagesCache = new Map<string, ProjectStagesContext | null>();
        const providerOwnerMap = await fetchVcsOwnersForRecords(connection, records);

        const workItems: WorkItem[] = [];

        for (const item of records) {
            const projectId: string = item?.DevopsProjectId;
            let ctx: ProjectStagesContext | null = null;
            if (projectId) {
                ctx = await ensureProjectStages(connection, projectStagesCache, projectId);
            }

            const mapped = mapRawItemToWorkItem(item, ctx, providerOwnerMap);
            workItems.push(mapped);
        }

        return workItems;
    } catch (error) {
        throw error;
    }
}
