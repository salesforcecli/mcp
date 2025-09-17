import { getConnection } from "../shared/auth.js";
import type { WorkItem } from "../types/WorkItem.js";
import { getPipelineMP } from "./getPipelineMP.js";
import { fetchPipelineStagesMP } from "./getPipelineStagesMP.js";

/**
 * Fetches work items for Managed Package orgs.
 */
export async function fetchWorkItemsMP(username: string, projectId: string): Promise<WorkItem[] | any> {
    try {
        const connection = await getConnection(username);
        const query = `
            SELECT
                Id,
                Name,
                sf_devops__Subject__c,
                sf_devops__Description__c,
                sf_devops__State__c,
                sf_devops__Assigned_To__c,
                sf_devops__Assigned_To__r.Name,
                sf_devops__Branch__c,
                sf_devops__Branch__r.Name,
                sf_devops__Branch__r.sf_devops__Repository__r.sf_devops__Url__c,
                sf_devops__Project__c
            FROM sf_devops__Work_Item__c
            WHERE sf_devops__Project__c = '${projectId}'
        `;

        const result: any = await connection.query(query);
        const records: any[] = result?.records || [];

        const workItems: WorkItem[] = records.map((item: any): WorkItem => {
            const ownerName: string | undefined = item?.sf_devops__Assigned_To__r?.Name;
            const ownerId: string | undefined = item?.sf_devops__Assigned_To__c;

            const mapped: WorkItem = {
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
                } : undefined
            };

            return mapped;
        });

        return workItems;
    } catch (error) {
        return error;
    }
}



/**
 * Fetches a specific work item by name for Managed Package orgs.
 */
export async function fetchWorkItemByNameMP(username: string, workItemName: string): Promise<WorkItem | null> {
    try {
        const connection = await getConnection(username);
        const query = `
            SELECT
                Id,
                Name,
                sf_devops__Subject__c,
                sf_devops__Description__c,
                sf_devops__Status__c,
                sf_devops__Assigned_To__c,
                sf_devops__Repository_Branch__c,
                sf_devops__Repository_Branch__r.Name,
                sf_devops__Repository_Branch__r.sf_devops__Repository__c,
                sf_devops__Repository_Branch__r.sf_devops__Repository__r.Name,
                sf_devops__Repository_Branch__r.sf_devops__Repository__r.sf_devops__Repository_Owner__c,
                sf_devops__Repository_Branch__r.sf_devops__Repository__r.sf_devops__Provider__c,
                sf_devops__Pipeline_Stage__c,
                sf_devops__Project__c
            FROM sf_devops__Work_Item__c
            WHERE Name = '${workItemName}'
            LIMIT 1
        `;

        const result: any = await connection.query(query);
        const item = (result?.records || [])[0];
        if (!item) {
            return null;
        }

        // Get pipeline info
        const projectId: string = item?.sf_devops__Project__c;
        const pipelineInfo = await getPipelineMP(username, projectId);
        if (!pipelineInfo || !pipelineInfo.pipelineId) {
            throw new Error(`Pipeline not found for project: ${projectId}`);
        }

        const stages = await fetchPipelineStagesMP(username, pipelineInfo.pipelineId);
        if (!stages || stages.length === 0) {
            throw new Error(`Stages not found for pipeline: ${pipelineInfo.pipelineId}`);
        }

        return mapRawItemToWorkItemMP(item, pipelineInfo.pipelineId, stages);
    } catch (error) {
        throw error;
    }
}

function mapRawItemToWorkItemMP(item: any, pipelineId: string, stages: any[]): WorkItem {
    return {
        id: item?.Id,
        name: item?.Name || "",
        subject: item?.sf_devops__Subject__c || undefined,
        status: item?.sf_devops__Status__c || "",
        owner: item?.sf_devops__Assigned_To__c || "",
        WorkItemBranch: item?.sf_devops__Repository_Branch__r?.Name || undefined,
        DevopsProjectId: item?.sf_devops__Project__c,
        PipelineId: pipelineId,
        PipelineStageId: item?.sf_devops__Pipeline_Stage__c,
        SourceCodeRepository: item?.sf_devops__Repository_Branch__r?.sf_devops__Repository__r ? {
            repoUrl: `https://github.com/${item.sf_devops__Repository_Branch__r.sf_devops__Repository__r.sf_devops__Repository_Owner__c}/${item.sf_devops__Repository_Branch__r.sf_devops__Repository__r.Name}`,
            repoType: item.sf_devops__Repository_Branch__r.sf_devops__Repository__r.sf_devops__Provider__c || "github"
        } : undefined
    } as WorkItem;
}
