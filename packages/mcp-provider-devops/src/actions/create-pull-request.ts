import { createPullRequest } from "../core/deployment/createPullRequest.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type CreatePullRequestInput = {
    workItemId: string;
    username: string;
};

export type CreatePullRequestOutput = {
    success: boolean;
    reviewUrl?: string;
    status: string;
    workItemId: string;
    errorMessage?: string;
};

type CreatePullRequestActionOptions = {
    telemetryService?: TelemetryService;
};

export interface CreatePullRequestAction {
    exec(input: CreatePullRequestInput): Promise<CreatePullRequestOutput>;
}

export class CreatePullRequestActionImpl implements CreatePullRequestAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: CreatePullRequestActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: CreatePullRequestInput): Promise<CreatePullRequestOutput> {
        try {
            this.telemetryService?.sendEvent("createPullRequestStarted", {
                workItemId: input.workItemId,
                username: input.username
            });

            const result = await createPullRequest({
                username: input.username,
                workItemId: input.workItemId
            });

            this.telemetryService?.sendEvent("createPullRequestCompleted", {
                workItemId: input.workItemId,
                success: true
            });

            return {
                success: true,
                reviewUrl: result.reviewUrl,
                status: "Pull request created successfully",
                workItemId: input.workItemId
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("createPullRequestError", {
                workItemId: input.workItemId,
                error: error.message
            });

            return {
                success: false,
                status: "Failed to create pull request",
                workItemId: input.workItemId,
                errorMessage: error.message
            };
        }
    }
}
