import type { Connection } from "@salesforce/core";

export interface DevopsProjectRecord {
    Id: string;
    Name: string;
    Description?: string;
}

export async function fetchProjects(connection: Connection): Promise<DevopsProjectRecord[]> {
    const query = "SELECT Id, Name, Description FROM DevopsProject";
    const result = await connection.query<DevopsProjectRecord>(query);
    return result.records ?? [];
}
