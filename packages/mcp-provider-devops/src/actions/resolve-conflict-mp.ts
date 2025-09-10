import { TelemetryService } from "@salesforce/mcp-provider-api";
import type { WorkItem } from "../types/WorkItem.js";
import { ResolveConflictActionImpl } from "./resolve-conflict.js";

export type ResolveConflictMPInput = {
    workItem: WorkItem;
    localPath?: string;
};

export type ResolveConflictMPOutput = {
    success: boolean;
    resolvedFiles: string[];
    message: string;
};

type ResolveConflictMPActionOptions = {
    telemetryService?: TelemetryService;
};

export interface ResolveConflictMPAction {
    exec(input: ResolveConflictMPInput): Promise<ResolveConflictMPOutput>;
}

export class ResolveConflictMPActionImpl implements ResolveConflictMPAction {
    private readonly resolveConflictAction: ResolveConflictActionImpl;
    private readonly telemetryService?: TelemetryService;

    constructor(options: ResolveConflictMPActionOptions = {}) {
        this.telemetryService = options.telemetryService;
        this.resolveConflictAction = new ResolveConflictActionImpl({ telemetryService: this.telemetryService });
    }

    public async exec(input: ResolveConflictMPInput): Promise<ResolveConflictMPOutput> {
        try {
            this.telemetryService?.sendEvent("resolveConflictMPStarted", {
                workItemId: input.workItem.id
            });

            // Use the same logic as the regular resolve conflict but with MP-specific telemetry
            const result = await this.resolveConflictAction.exec({
                workItem: input.workItem,
                localPath: input.localPath
            });

            this.telemetryService?.sendEvent("resolveConflictMPCompleted", {
                success: result.success,
                resolvedFiles: result.resolvedFiles?.length || 0
            });

            return result;
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("resolveConflictMPError", {
                error: error.message
            });

            return {
                success: false,
                resolvedFiles: [],
                message: `Error: ${error.message}`
            };
        }
    }
}
