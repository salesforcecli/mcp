import { getConnection } from "./shared/auth.js";

export interface DevopsProjectRecord {
    Id: string;
    Name: string;
    Description?: string;
}

export async function fetchProjects(username: string): Promise<DevopsProjectRecord[]> {
    const connection = await getConnection(username);
    const query = "SELECT Id, Name, Description FROM DevopsProject";
    const result = await connection.query<DevopsProjectRecord>(query);
    return result.records ?? [];
}
