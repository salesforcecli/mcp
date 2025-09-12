import { createWorkItem } from "../core/projects/createWorkItem.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type CreateWorkItemInput = {
    username: string;
    projectId: string;
    subject: string;
    description: string;
};

export type CreateWorkItemOutput = {
    success: boolean;
    workItemId?: string;
    message: string;
};

type CreateWorkItemActionOptions = {
    telemetryService?: TelemetryService;
};

export interface CreateWorkItemAction {
    exec(input: CreateWorkItemInput): Promise<CreateWorkItemOutput>;
}

export class CreateWorkItemActionImpl implements CreateWorkItemAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: CreateWorkItemActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: CreateWorkItemInput): Promise<CreateWorkItemOutput> {
        try {
            this.telemetryService?.sendEvent("createWorkItemStarted", {
                username: input.username,
                projectId: input.projectId,
                subject: input.subject
            });

            const result = await createWorkItem({
                username: input.username,
                projectId: input.projectId,
                subject: input.subject,
                description: input.description
            });

            this.telemetryService?.sendEvent("createWorkItemCompleted", {
                success: true
            });

            return {
                success: true,
                workItemId: result.id,
                message: `Work item created successfully with ID: ${result.id}`
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("createWorkItemError", {
                error: error.message
            });

            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    }
}
