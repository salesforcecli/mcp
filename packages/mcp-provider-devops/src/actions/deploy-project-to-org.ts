import { deployProjectToOrg } from "../core/deployment/deployProjectToOrg.js";
import { TelemetryService } from "@salesforce/mcp-provider-api";

export type DeployProjectToOrgInput = {
    targetOrg: string;
    projectDir: string;
};

export type DeployProjectToOrgOutput = {
    success: boolean;
    message: string;
    deployResult?: unknown;
};

type DeployProjectToOrgActionOptions = {
    telemetryService?: TelemetryService;
};

export interface DeployProjectToOrgAction {
    exec(input: DeployProjectToOrgInput): Promise<DeployProjectToOrgOutput>;
}

export class DeployProjectToOrgActionImpl implements DeployProjectToOrgAction {
    private readonly telemetryService?: TelemetryService;

    constructor(options: DeployProjectToOrgActionOptions = {}) {
        this.telemetryService = options.telemetryService;
    }

    public async exec(input: DeployProjectToOrgInput): Promise<DeployProjectToOrgOutput> {
        try {
            this.telemetryService?.sendEvent("deployProjectToOrgStarted", {
                targetOrg: input.targetOrg,
                projectDir: input.projectDir
            });

            const result = await deployProjectToOrg({
                targetOrg: input.targetOrg,
                projectDir: input.projectDir
            });

            this.telemetryService?.sendEvent("deployProjectToOrgCompleted", {
                success: result.success
            });

            return {
                success: result.success,
                message: result.output,
                deployResult: result
            };
        } catch (error: Error | any) {
            this.telemetryService?.sendEvent("deployProjectToOrgError", {
                error: error.message
            });

            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    }
}
