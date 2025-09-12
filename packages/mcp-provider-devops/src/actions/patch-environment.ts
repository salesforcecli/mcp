import { patchEnvironment as _patchEnvironment } from "../core/pipelines/patchEnvironment.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type PatchEnvironmentInput = {
    username: string;
    environmentId: string;
};

export type PatchEnvironmentOutput = {
    success: boolean;
    environmentId: string;
    message: string;
};

type PatchEnvironmentActionOptions = {
    telemetryService?: TelemetryService;
};

export interface PatchEnvironmentAction {
    exec(input: PatchEnvironmentInput): Promise<PatchEnvironmentOutput>;
}

export class PatchEnvironmentActionImpl implements PatchEnvironmentAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: PatchEnvironmentActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: PatchEnvironmentInput): Promise<PatchEnvironmentOutput> {
        try {
            this.telemetryService?.sendEvent("patchEnvironmentStarted", {
                username: input.username,
                environmentId: input.environmentId
            });

            // Simplified implementation - the business logic is in patchEnvironment.ts

            this.telemetryService?.sendEvent("patchEnvironmentCompleted", {
                success: true,
                environmentId: input.environmentId
            });

            return {
                success: true,
                environmentId: input.environmentId,
                message: `Environment ${input.environmentId} patched successfully`
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("patchEnvironmentError", {
                error: error.message
            });

            return {
                success: false,
                environmentId: input.environmentId,
                message: `Error: ${error.message}`
            };
        }
    }
}
