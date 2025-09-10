import { promoteWorkItems } from "../core/deployment/promoteWorkItems.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type PromoteWorkItemInput = {
    username: string;
    project: {
        id: string;
        name: string;
    };
    workitems: Array<{
        id: string;
        PipelineId: string;
        PipelineStageId: string;
        TargetStageId: string;
    }>;
};

export type PromoteWorkItemOutput = {
    requestId?: string;
    status: string;
    message: string;
};

type PromoteWorkItemActionOptions = {
    telemetryService?: TelemetryService;
};

export interface PromoteWorkItemAction {
    exec(input: PromoteWorkItemInput): Promise<PromoteWorkItemOutput>;
}

export class PromoteWorkItemActionImpl implements PromoteWorkItemAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: PromoteWorkItemActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: PromoteWorkItemInput): Promise<PromoteWorkItemOutput> {
        try {
            this.telemetryService?.sendEvent("promoteWorkItemStarted", {
                username: input.username,
                projectId: input.project.id,
                workItemCount: input.workitems.length
            });

            // Basic validation
            if (!input.workitems || input.workitems.length === 0) {
                return {
                    status: "error",
                    message: "No work items provided. Please select work items to promote."
                };
            }

            // Call the business logic function
            const result = await promoteWorkItems(input.username, {
                workitems: input.workitems
            });

            this.telemetryService?.sendEvent("promoteWorkItemCompleted", {
                workItemCount: input.workitems.length,
                success: true
            });

            return {
                requestId: result.requestId,
                status: "success",
                message: `Successfully initiated promotion of ${input.workitems.length} work item(s). ${result.requestId ? `Request ID: ${result.requestId}` : ''}`
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("promoteWorkItemError", {
                error: error.message
            });

            return {
                status: "error",
                message: `Error: ${error.message}`
            };
        }
    }
}
