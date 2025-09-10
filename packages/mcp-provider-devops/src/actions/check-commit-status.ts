import { getConnection } from "../shared/auth.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type CheckCommitStatusInput = {
    username: string;
    requestId: string;
};

export type CheckCommitStatusOutput = {
    status: string;
    requestToken: string;
    result?: unknown;
};

type CheckCommitStatusActionOptions = {
    telemetryService?: TelemetryService;
};

export interface CheckCommitStatusAction {
    exec(input: CheckCommitStatusInput): Promise<CheckCommitStatusOutput>;
}

export class CheckCommitStatusActionImpl implements CheckCommitStatusAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: CheckCommitStatusActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: CheckCommitStatusInput): Promise<CheckCommitStatusOutput> {
        try {
            this.telemetryService?.sendEvent("checkCommitStatusStarted", {
                username: input.username,
                requestId: input.requestId
            });

            const connection = await getConnection(input.username);
            
            // Query DevopsRequestInfo object for the request status
            const query = `SELECT Status, RequestToken FROM DevopsRequestInfo WHERE RequestToken = '${input.requestId}' LIMIT 1`;
            const result = await connection.query(query);
            
            if (result.records && result.records.length > 0) {
                const record = result.records[0] as any;
                
                this.telemetryService?.sendEvent("checkCommitStatusCompleted", {
                    status: record.Status,
                    requestToken: record.RequestToken
                });

                return {
                    status: record.Status,
                    requestToken: record.RequestToken,
                    result: record
                };
            } else {
                return {
                    status: "Not Found",
                    requestToken: input.requestId,
                    result: "No record found for the specified request ID"
                };
            }
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("checkCommitStatusError", {
                error: error.message
            });

            return {
                status: `Error: ${error.message}`,
                requestToken: input.requestId
            };
        }
    }
}
