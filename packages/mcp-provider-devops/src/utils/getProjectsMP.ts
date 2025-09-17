import { getConnection } from "../shared/auth.js";

export interface DevopsProjectRecordMP {
    Id: string;
    Name: string;
    Description?: string;
}

/**
 * Fetches projects for Managed Package orgs.
 */
export async function fetchProjectsMP(username: string): Promise<DevopsProjectRecordMP[] | any> {
    try {
        const connection = await getConnection(username);
        const query = "SELECT Id, Name, sf_devops__Description__c FROM sf_devops__Project__c";
        const result = await connection.query<{ Id: string; Name: string; sf_devops__Description__c?: string }>(query);
        const records: DevopsProjectRecordMP[] = (result.records ?? []).map((r: any) => ({
            Id: r.Id,
            Name: r.Name,
            Description: r.sf_devops__Description__c
        }));
        return records;
    } catch (error) {
        return error;
    }
}


