import { TelemetryService } from "@salesforce/mcp-provider-api";
import type { WorkItem } from "../types/WorkItem.js";
import { DetectConflictActionImpl } from "./detect-conflict.js";

export type DetectConflictMPInput = {
    workItem: WorkItem;
    localPath?: string;
};

export type DetectConflictMPOutput = {
    hasConflicts: boolean;
    conflictedFiles: string[];
    message: string;
};

type DetectConflictMPActionOptions = {
    telemetryService?: TelemetryService;
};

export interface DetectConflictMPAction {
    exec(input: DetectConflictMPInput): Promise<DetectConflictMPOutput>;
}

export class DetectConflictMPActionImpl implements DetectConflictMPAction {
    private readonly detectConflictAction: DetectConflictActionImpl;
    private readonly telemetryService?: TelemetryService;

    constructor(options: DetectConflictMPActionOptions = {}) {
        this.telemetryService = options.telemetryService;
        this.detectConflictAction = new DetectConflictActionImpl({ telemetryService: this.telemetryService });
    }

    public async exec(input: DetectConflictMPInput): Promise<DetectConflictMPOutput> {
        try {
            this.telemetryService?.sendEvent("detectConflictMPStarted", {
                workItemId: input.workItem.id
            });

            // Use the same logic as the regular detect conflict but with MP-specific telemetry
            const result = await this.detectConflictAction.exec({
                workItem: input.workItem,
                localPath: input.localPath
            });

            this.telemetryService?.sendEvent("detectConflictMPCompleted", {
                hasConflicts: result.hasConflicts,
                conflictedFiles: result.conflictedFiles?.length || 0
            });

            return result;
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("detectConflictMPError", {
                error: error.message
            });

            return {
                hasConflicts: false,
                conflictedFiles: [],
                message: `Error: ${error.message}`
            };
        }
    }
}
