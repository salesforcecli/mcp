import { getConnection } from "../shared/auth.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type GetChangesInput = {
    username: string;
    limit?: number;
    offset?: number;
};

export type GetChangesOutput = {
    changes: Array<{
        fullName: string;
        type: string;
        operation: string;
        [key: string]: unknown;
    }>;
    status: string;
};

type GetChangesActionOptions = {
    telemetryService?: TelemetryService;
};

export interface GetChangesAction {
    exec(input: GetChangesInput): Promise<GetChangesOutput>;
}

export class GetChangesActionImpl implements GetChangesAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: GetChangesActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: GetChangesInput): Promise<GetChangesOutput> {
        try {
            this.telemetryService?.sendEvent("getChangesStarted", {
                username: input.username,
                limit: input.limit,
                offset: input.offset
            });

            const connection = await getConnection(input.username);
            
            // Query for changes from the Salesforce org
            const query = `
                SELECT FullName, Type, Operation, CreatedDate, LastModifiedDate
                FROM MetadataPackageMember 
                ORDER BY LastModifiedDate DESC
                LIMIT ${input.limit || 30}
                OFFSET ${input.offset || 0}
            `;
            
            const result = await connection.query(query);
            const changes = (result as any).records || [];

            this.telemetryService?.sendEvent("getChangesCompleted", {
                changeCount: changes.length
            });

            return {
                changes,
                status: "success"
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("getChangesError", {
                error: error.message
            });

            return {
                changes: [],
                status: `Error: ${error.message}`
            };
        }
    }
}
