import { getAllAllowedOrgs } from "../shared/auth.js";
import type { SanitizedOrgAuthorization } from "../shared/types.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type ListOrgsInput = {
    // No input parameters needed - lists all authenticated orgs
};

export type ListOrgsOutput = {
    orgs: (SanitizedOrgAuthorization & { orgType?: string })[];
    status: string;
};

type ListOrgsActionOptions = {
    telemetryService?: TelemetryService;
};

export interface ListOrgsAction {
    exec(input: ListOrgsInput): Promise<ListOrgsOutput>;
}

export class ListOrgsActionImpl implements ListOrgsAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: ListOrgsActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(_input: ListOrgsInput): Promise<ListOrgsOutput> {
        try {
            this.telemetryService?.sendEvent("listOrgsStarted", {});

            const orgs = await getAllAllowedOrgs();

            this.telemetryService?.sendEvent("listOrgsCompleted", {
                orgCount: orgs.length
            });

            return {
                orgs,
                status: "success"
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("listOrgsError", {
                error: error.message
            });

            return {
                orgs: [],
                status: `Error: ${error.message}`
            };
        }
    }
}
