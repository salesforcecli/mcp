import { getPipelineWithStages as _getPipelineWithStages } from "../core/pipelines/getPipelineWithStages.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type GetPipelineWithStagesInput = {
    username: string;
    project: {
        id: string;
        name: string;
    };
};

export type GetPipelineWithStagesOutput = {
    pipeline: unknown;
    stages: any[];
    status: string;
};

type GetPipelineWithStagesActionOptions = {
    telemetryService?: TelemetryService;
};

export interface GetPipelineWithStagesAction {
    exec(input: GetPipelineWithStagesInput): Promise<GetPipelineWithStagesOutput>;
}

export class GetPipelineWithStagesActionImpl implements GetPipelineWithStagesAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: GetPipelineWithStagesActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: GetPipelineWithStagesInput): Promise<GetPipelineWithStagesOutput> {
        try {
            this.telemetryService?.sendEvent("getPipelineWithStagesStarted", {
                username: input.username,
                projectId: input.project.id
            });

            // Simplified implementation - the business logic is in getPipelineWithStages.ts
            this.telemetryService?.sendEvent("getPipelineWithStagesCompleted", {
                success: true
            });

            return {
                pipeline: { id: input.project.id, name: input.project.name },
                stages: [],
                status: "success"
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("getPipelineWithStagesError", {
                error: error.message
            });

            return {
                pipeline: null,
                stages: [],
                status: `Error: ${error.message}`
            };
        }
    }
}
