import { getConnection } from "../shared/auth.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type ListProjectsInput = {
    username: string;
};

export type ListProjectsOutput = {
    projects: Array<{
        Id: string;
        Name: string;
        Description?: string;
        CreatedDate?: string;
        LastModifiedDate?: string;
    }>;
    status: string;
};

type ListProjectsActionOptions = {
    telemetryService?: TelemetryService;
};

export interface ListProjectsAction {
    exec(input: ListProjectsInput): Promise<ListProjectsOutput>;
}

export class ListProjectsActionImpl implements ListProjectsAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: ListProjectsActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: ListProjectsInput): Promise<ListProjectsOutput> {
        try {
            this.telemetryService?.sendEvent("listProjectsStarted", {
                username: input.username
            });

            const connection = await getConnection(input.username);
            const query = `SELECT Id, Name, Description, CreatedDate, LastModifiedDate FROM DevopsProject ORDER BY Name`;
            
            const result = await connection.query(query);
            const projects = (result as any).records || [];

            this.telemetryService?.sendEvent("listProjectsCompleted", {
                projectCount: projects.length
            });

            return {
                projects,
                status: "success"
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("listProjectsError", {
                error: error.message
            });

            return {
                projects: [],
                status: `Error: ${error.message}`
            };
        }
    }
}
