import { randomUUID } from "crypto";
import { commitWorkItem } from "../core/workitems/commitWorkItem.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type CommitWorkItemInput = {
    doceHubUsername: string;
    sandboxUsername: string;
    workItem: {
        id: string;
    };
    commitMessage: string;
    changes: Array<{
        fullName: string;
        type: string;
        operation: string;
    }>;
};

export type CommitWorkItemOutput = {
    requestId: string;
    status: string;
    message: string;
};

type CommitWorkItemActionOptions = {
    telemetryService?: TelemetryService;
};

export interface CommitWorkItemAction {
    exec(input: CommitWorkItemInput): Promise<CommitWorkItemOutput>;
}

export class CommitWorkItemActionImpl implements CommitWorkItemAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: CommitWorkItemActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: CommitWorkItemInput): Promise<CommitWorkItemOutput> {
        try {
            this.telemetryService?.sendEvent("commitWorkItemStarted", {
                workItemId: input.workItem.id,
                changeCount: input.changes.length
            });

            // Basic validation
            if (!input.workItem || !input.workItem.id) {
                return {
                    requestId: "",
                    status: "error",
                    message: "Work item ID is required. Please provide a work item with an ID."
                };
            }

            if (!input.changes || input.changes.length === 0) {
                return {
                    requestId: "",
                    status: "error",
                    message: "No changes provided. Please fetch changes using 'sf-devops-get-changes' first."
                };
            }

            if (!input.commitMessage || input.commitMessage.trim() === "") {
                return {
                    requestId: "",
                    status: "error",
                    message: "Commit message is required. Please provide a descriptive commit message."
                };
            }

            // Generate request ID for tracking
            const requestId = randomUUID();

            // Call the business logic function with all required parameters
            const _result = await commitWorkItem({
                doceHubUsername: input.doceHubUsername,
                sandboxUsername: input.sandboxUsername,
                workItem: input.workItem,
                requestId,
                commitMessage: input.commitMessage,
                changes: input.changes
            });

            this.telemetryService?.sendEvent("commitWorkItemCompleted", {
                workItemId: input.workItem.id,
                requestId,
                success: true
            });

            return {
                requestId,
                status: "success",
                message: `Successfully initiated commit for work item ${input.workItem.id}. Use request ID ${requestId} to track the status.`
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("commitWorkItemError", {
                workItemId: input.workItem.id,
                error: error.message
            });

            return {
                requestId: "",
                status: "error",
                message: `Error: ${error.message}`
            };
        }
    }
}
