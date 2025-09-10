import { createPipeline } from "../core/pipelines/createPipeline.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type CreatePipelineInput = {
    username: string;
    pipeline_name: string;
    repo_url: string;
    stages?: Array<{
        name: string;
        branch: string;
        environment: string;
    }>;
};

export type CreatePipelineOutput = {
    success: boolean;
    pipelineId?: string;
    message: string;
};

type CreatePipelineActionOptions = {
    telemetryService?: TelemetryService;
};

export interface CreatePipelineAction {
    exec(input: CreatePipelineInput): Promise<CreatePipelineOutput>;
}

export class CreatePipelineActionImpl implements CreatePipelineAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: CreatePipelineActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: CreatePipelineInput): Promise<CreatePipelineOutput> {
        try {
            this.telemetryService?.sendEvent("createPipelineStarted", {
                username: input.username,
                pipeline_name: input.pipeline_name
            });

            const result = await createPipeline({
                username: input.username,
                pipeline_name: input.pipeline_name,
                repo_url: input.repo_url,
                stages: input.stages
            });

            this.telemetryService?.sendEvent("createPipelineCompleted", {
                success: true
            });

            return {
                success: true,
                pipelineId: result.id,
                message: `Pipeline created successfully: ${input.pipeline_name}`
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("createPipelineError", {
                error: error.message
            });

            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    }
}
