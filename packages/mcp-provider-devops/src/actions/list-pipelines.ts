import { fetchPipelines } from "../core/pipelines/getPipelines.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type ListPipelinesInput = {
    username: string;
};

export type ListPipelinesOutput = {
    pipelines: any[];
    status: string;
};

type ListPipelinesActionOptions = {
    telemetryService?: TelemetryService;
};

export interface ListPipelinesAction {
    exec(input: ListPipelinesInput): Promise<ListPipelinesOutput>;
}

export class ListPipelinesActionImpl implements ListPipelinesAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: ListPipelinesActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: ListPipelinesInput): Promise<ListPipelinesOutput> {
        try {
            this.telemetryService?.sendEvent("listPipelinesStarted", {
                username: input.username
            });

            const pipelines = await fetchPipelines(input.username);

            this.telemetryService?.sendEvent("listPipelinesCompleted", {
                pipelineCount: pipelines.length
            });

            return {
                pipelines,
                status: "success"
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("listPipelinesError", {
                error: error.message
            });

            return {
                pipelines: [],
                status: `Error: ${error.message}`
            };
        }
    }
}
