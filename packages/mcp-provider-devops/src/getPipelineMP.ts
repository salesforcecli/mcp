import { getConnection } from "./shared/auth.js";

export interface DevopsPipelineRecordMP {
    Id: string;
    Name: string;
    sf_devops__Activated__c?: boolean;
    sf_devops__Project__c: string;
}

/**
 * Fetch the Managed Package DevOps pipeline for a given Project Id.
 * Returns the first matching pipeline or null if none found.
 */
export async function getPipelineMP(username: string, projectId: string): Promise<DevopsPipelineRecordMP | null | any> {
    try {
        const connection = await getConnection(username);
        const query = `
            SELECT Id, Name, sf_devops__Activated__c, sf_devops__Project__c
            FROM sf_devops__Pipeline__c
            WHERE sf_devops__Project__c = '${projectId}'
              AND sf_devops__Activated__c = true
            LIMIT 1
        `;
        const result = await connection.query<DevopsPipelineRecordMP>(query);
        const record = (result.records ?? [])[0];
        return record || null;
    } catch (error) {
        return error;
    }
}


