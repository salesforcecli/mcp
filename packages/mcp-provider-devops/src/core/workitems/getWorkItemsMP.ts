import { getConnection } from "../../shared/auth.js";
import type { WorkItem } from "../../types/WorkItem.js";

export async function fetchWorkItemsMP(username: string, projectId: string): Promise<WorkItem[] | any> {
    try {
        const connection = await getConnection(username);
        const query = `
            SELECT
                Id,
                Name,
                sf_devops__Subject__c,
                sf_devops__Description__c,
                sf_devops__Branch__c.Name
            FROM sf_devops__Work_Item__c
            WHERE sf_devops__Project__c = '${projectId}'
        `;

        const result: unknown = await connection.query(query);
        const records: any[] = (result as any)?.records || [];

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
                DevopsProjectId: item?.sf_devops__Project__c
            };

            return mapped;
        });

        return workItems;
    } catch (error) {
        return error;
    }
}




