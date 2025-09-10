import { getWorkItemWithTargetBranch } from "../core/pipelines/getTargetBranch.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";
import type { WorkItem } from "../types/WorkItem.js";

export type GetTargetBranchInput = {
    username: string;
    workItem: WorkItem;
    pipelineId?: string;
};

export type GetTargetBranchOutput = {
    workItem: WorkItem;
    targetBranch: string;
    status: string;
};

type GetTargetBranchActionOptions = {
    telemetryService?: TelemetryService;
};

export interface GetTargetBranchAction {
    exec(input: GetTargetBranchInput): Promise<GetTargetBranchOutput>;
}

export class GetTargetBranchActionImpl implements GetTargetBranchAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: GetTargetBranchActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: GetTargetBranchInput): Promise<GetTargetBranchOutput> {
        try {
            this.telemetryService?.sendEvent("getTargetBranchStarted", {
                username: input.username,
                workItemId: input.workItem.id
            });

            const result = await getWorkItemWithTargetBranch({
                username: input.username,
                workItem: input.workItem
            });

            this.telemetryService?.sendEvent("getTargetBranchCompleted", {
                success: true,
                targetBranch: result.TargetBranch
            });

            return {
                workItem: result,
                targetBranch: result.TargetBranch || "",
                status: "success"
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("getTargetBranchError", {
                error: error.message
            });

            return {
                workItem: input.workItem,
                targetBranch: "",
                status: `Error: ${error.message}`
            };
        }
    }
}
