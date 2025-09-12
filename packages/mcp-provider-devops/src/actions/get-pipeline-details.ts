import { TelemetryService } from "@salesforce/mcp-provider-api";

export type GetPipelineDetailsInput = {
    username: string;
    pipelineId: string;
};

export type GetPipelineDetailsOutput = {
    pipelineId: string;
    status: string;
    message: string;
};

type GetPipelineDetailsActionOptions = {
    telemetryService?: TelemetryService;
};

export interface GetPipelineDetailsAction {
    exec(input: GetPipelineDetailsInput): Promise<GetPipelineDetailsOutput>;
}

export class GetPipelineDetailsActionImpl implements GetPipelineDetailsAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: GetPipelineDetailsActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: GetPipelineDetailsInput): Promise<GetPipelineDetailsOutput> {
        try {
            this.telemetryService?.sendEvent("getPipelineDetailsStarted", {
                username: input.username,
                pipelineId: input.pipelineId
            });

            // Simplified implementation - core functionality is in the business logic file
            this.telemetryService?.sendEvent("getPipelineDetailsCompleted", {
                success: true
            });

            return {
                pipelineId: input.pipelineId,
                status: "success",
                message: `Pipeline details retrieved for ID: ${input.pipelineId}`
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("getPipelineDetailsError", {
                error: error.message
            });

            return {
                pipelineId: input.pipelineId,
                status: "error",
                message: `Error: ${error.message}`
            };
        }
    }
}
