import { getConnection } from "../shared/auth.js";

export interface DevopsPipelineRecord {
    Id: string;
    IsActive: boolean;
    Name: string;
    SourceCodeRepositoryId?: string;
}

export async function fetchPipelines(username: string): Promise<DevopsPipelineRecord[] | any> {
    try {
        const connection = await getConnection(username);
        const query = "SELECT Id, IsActive, Name, SourceCodeRepositoryId FROM DevopsPipeline";
        const result = await connection.query<DevopsPipelineRecord>(query);
        return result.records ?? [];
    } catch (error) {
        return error;
    }
}


