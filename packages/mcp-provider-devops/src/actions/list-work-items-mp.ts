import { fetchWorkItemsMP } from "../core/workitems/getWorkItemsMP.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";
import type { WorkItem } from "../types/WorkItem.js";

export type ListWorkItemsMPInput = {
    username: string;
    project: {
        Id: string;
        Name?: string;
    };
};

export type ListWorkItemsMPOutput = {
    workItems: WorkItem[];
    status: string;
};

type ListWorkItemsMPActionOptions = {
    telemetryService?: TelemetryService;
};

export interface ListWorkItemsMPAction {
    exec(input: ListWorkItemsMPInput): Promise<ListWorkItemsMPOutput>;
}

export class ListWorkItemsMPActionImpl implements ListWorkItemsMPAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: ListWorkItemsMPActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: ListWorkItemsMPInput): Promise<ListWorkItemsMPOutput> {
        try {
            this.telemetryService?.sendEvent("listWorkItemsMPStarted", {
                username: input.username,
                projectId: input.project.Id
            });

            const workItems = await fetchWorkItemsMP(input.username, input.project.Id);

            this.telemetryService?.sendEvent("listWorkItemsMPCompleted", {
                workItemCount: workItems.length
            });

            return {
                workItems,
                status: "success"
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("listWorkItemsMPError", {
                error: error.message
            });

            return {
                workItems: [],
                status: `Error: ${error.message}`
            };
        }
    }
}
