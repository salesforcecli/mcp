import { getConnection } from "./shared/auth.js";
import type { WorkItem } from "./types/WorkItem.js";
import { getPipelineMP } from "./getPipelineMP.js";
import { fetchPipelineStagesMP } from "./getPipelineStagesMP.js";


export async function fetchWorkItemByNameMP(username: string, workItemName: string): Promise<WorkItem | null | any> {
    try {
        const connection = await getConnection(username);

        const item = await queryWorkItemByName(connection, workItemName);
        if (!item) {
            return { error: { message: `Work Item '${workItemName}' not found. Please verify the Work Item Name/Number and try again.` } };
        }
        if (item?.sf_devops__Concluded__c && String(item.sf_devops__Concluded__c).trim().length > 0) {
            return { error: { message: `Work Item '${workItemName}' is concluded. No further actions required.` } };
        }
        const pipeline = await ensurePipelineForProject(username, item?.sf_devops__Project__c, workItemName);
        if ((pipeline as any)?.error) {
            return { error: { message: `Pipeline not found for project ${item?.sf_devops__Project__c}. Please verify the Project Name and try again.` } };
        }

        const stages = await ensureStagesForPipeline(username, (pipeline as any).Id, (pipeline as any).Name);
        if ((stages as any)?.error) {
            return { error: { message: `Stages not found for pipeline ${pipeline?.Name}. Please verify the Pipeline Name and try again.` } };
        }

        const firstStageId = computeFirstStageIdMP(stages as any[]);
        const idToStage = indexStagesById(stages as any[]);
        const orderedStages = orderStagesFromFirst(idToStage, firstStageId);
        const completedStageIds = await getCompletedStageIds(connection, item?.Id);
        const currentStageId = findHighestReachedStageId(orderedStages, completedStageIds);
        const targetStageId = computeTargetStageIdMP(currentStageId, idToStage, firstStageId);
        const targetBranch = computeTargetBranchMP(targetStageId, idToStage);
        const mapped = mapWorkItemCoreMP(item);
        (mapped as any).PipelineId = (pipeline as any).Id;
        if (targetStageId) {
            (mapped as any).TargetStageId = targetStageId;
            if (targetBranch) {
                (mapped as any).TargetBranch = targetBranch;
            }
        }
        return mapped;
    } catch (error) {
        return error;
    }
}

async function queryWorkItemByName(connection: any, workItemName: string): Promise<any | null> {
    const query = `
        SELECT Id,
        Name,
        sf_devops__Subject__c,
        sf_devops__Description__c,
        sf_devops__State__c,
        sf_devops__Concluded__c,
        sf_devops__Assigned_To__c, sf_devops__Assigned_To__r.Name,
        sf_devops__Branch__c, sf_devops__Branch__r.Name, 
        sf_devops__Branch__r.sf_devops__Repository__r.sf_devops__Url__c, sf_devops__Project__c
        FROM sf_devops__Work_Item__c
        WHERE Name = '${workItemName}'
        LIMIT 1
    `;
    const result: any = await connection.query(query);
    return (result?.records || [])[0] || null;
}

async function ensurePipelineForProject(username: string, projectId: string, workItemName: string): Promise<any> {
    const pipeline = await getPipelineMP(username, projectId);
    if (!pipeline) {
        return { error: { message: `Work item ${workItemName} is not mapped to a pipeline` } };
    }
    return pipeline;
}

async function ensureStagesForPipeline(username: string, pipelineId: string, pipelineName?: string): Promise<any[] | any> {
    const stages = await fetchPipelineStagesMP(username, pipelineId);
    if (!stages) {
        return { error: { message: `Stages not found for pipeline ${pipelineName || pipelineId}` } };
    }
    return stages as any[];
}

function computeFirstStageIdMP(stages: any[]): string | undefined {
    const allStageIds = new Set(stages.map((s: any) => s.Id));
    const nextIds = new Set(stages.map((s: any) => s.NextStageId).filter(Boolean));
    return Array.from(allStageIds).find(id => !nextIds.has(id));
}

function indexStagesById(stages: any[]): Map<string, any> {
    const idToStage = new Map<string, any>();
    stages.forEach((s: any) => idToStage.set(s.Id, s));
    return idToStage;
}

function orderStagesFromFirst(idToStage: Map<string, any>, firstStageId?: string): any[] {
    const ordered: any[] = [];
    const visited = new Set<string>();
    let cursor: string | undefined = firstStageId as string | undefined;
    while (cursor && !visited.has(cursor)) {
        const st = idToStage.get(cursor);
        if (!st) break;
        ordered.push(st);
        visited.add(cursor);
        cursor = st.NextStageId;
    }
    return ordered;
}

async function getCompletedStageIds(connection: any, workItemId: string): Promise<Set<string>> {
    const completed = new Set<string>();
    const q = `
        SELECT Id, sf_devops__Pipeline_Stage__c, sf_devops__Deployment_Result__r.sf_devops__Completion_Date__c
        FROM sf_devops__Work_Item_Promote__c
        WHERE sf_devops__Work_Item__c = '${workItemId}'
          AND sf_devops__Deployment_Result__r.sf_devops__Completion_Date__c != NULL
          AND sf_devops__Deployment_Result__r.sf_devops__Deployment_Id__c != NULL
    `;
    const res: any = await connection.query(q);
    const rows: any[] = res?.records || [];
    for (const rec of rows) {
        if (rec?.sf_devops__Deployment_Result__r?.sf_devops__Completion_Date__c && rec?.sf_devops__Pipeline_Stage__c) {
            completed.add(rec.sf_devops__Pipeline_Stage__c);
        }
    }
    return completed;
}

function findHighestReachedStageId(orderedStages: any[], completedStageIds: Set<string>): string | undefined {
    for (let i = orderedStages.length - 1; i >= 0; i--) {
        if (completedStageIds.has(orderedStages[i].Id)) {
            return orderedStages[i].Id;
        }
    }
    return undefined;
}

function computeTargetStageIdMP(currentStageId: string | undefined, idToStage: Map<string, any>, firstStageId?: string): string | undefined {
    if (currentStageId) {
        const current = idToStage.get(currentStageId);
        if (current?.NextStageId) return current.NextStageId as string;
    }
    return firstStageId as string | undefined;
}

function computeTargetBranchMP(targetStageId: string | undefined, idToStage: Map<string, any>): string | undefined {
    if (!targetStageId) return undefined;
    const targetStage = idToStage.get(targetStageId);
    return targetStage?.BranchName as string | undefined;
}

function mapWorkItemCoreMP(item: any): WorkItem {
    const ownerName: string | undefined = item?.sf_devops__Assigned_To__r?.Name;
    const ownerId: string | undefined = item?.sf_devops__Assigned_To__c;
    return {
        id: item?.Id,
        name: item?.Name || "",
        subject: item?.sf_devops__Subject__c || undefined,
        status: item?.sf_devops__State__c || "",
        owner: ownerName || ownerId || "",
        WorkItemBranch: item?.sf_devops__Branch__r?.Name || undefined,
        DevopsProjectId: item?.sf_devops__Project__c,
        SourceCodeRepository: item?.sf_devops__Branch__r?.sf_devops__Repository__r?.sf_devops__Url__c ? {
            repoUrl: item.sf_devops__Branch__r.sf_devops__Repository__r.sf_devops__Url__c,
            repoType: "github"
        } : undefined,
    } as WorkItem;
}
