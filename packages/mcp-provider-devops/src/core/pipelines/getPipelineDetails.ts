import { getConnection } from "../../shared/auth.js";
import axios from "axios";

export interface PipelineStageEnriched {
    Id: string;
    Name: string;
    DevOpsEnvironment?: unknown;
    SourceCodeRepositoryBranchId?: string;
    Environment?: unknown;
    Branch?: {
        Name: string;
        Repository: {
            Name: string;
            Provider: string;
            Owner: string;
        }
    } | null;
}

export interface PipelineDetailsResponse {
    stages?: PipelineStageEnriched[] | null;
    developmentEnvironments?: any[] | null;
    error?: {
        message: string;
        details?: unknown;
    };
}

export async function getPipelineDetails(username: string, pipelineId: string): Promise<PipelineDetailsResponse> {
    try {
        const connection = await getConnection(username);
        const accessToken = connection.accessToken;
        const instanceUrl = connection.instanceUrl;

        if (!accessToken || !instanceUrl) {
            throw new Error("Missing access token or instance URL.");
        }

        const apiVersion = "v65.0";
        const queryUrl = `${instanceUrl}/services/data/${apiVersion}/query`;
        const headers = { "Authorization": `Bearer ${accessToken}` };

        // Fetch stages for the pipeline
        const stageQuery = `SELECT Id, Name, DevOpsEnvironmentId, SourceCodeRepositoryBranchId FROM DevopsPipelineStage WHERE DevopsPipelineId = '${pipelineId}'`;
        const stageResp = await axios.get(queryUrl, { headers, params: { q: stageQuery } });
        const stageRecords = stageResp.data?.records || [];

        const enrichedStages: PipelineStageEnriched[] = [];

        for (const stage of stageRecords) {
            const stageId = stage["Id"];
            const stageName = stage["Name"];
            const envId = stage["DevOpsEnvironmentId"];
            const branchId = stage["SourceCodeRepositoryBranchId"];

            // Environment details
            let envDetails: unknown = null;
            if (envId) {
                const envUrl = `${instanceUrl}/services/data/${apiVersion}/connect/devops/environment/${envId}`;
                const envResp = await axios.get(envUrl, { headers: { ...headers, "Content-Type": "application/json" } });
                envDetails = envResp.data;
                if (envDetails && (envDetails as any).redirectUrl) {
                    (envDetails as any).redirectUrl = (envDetails as any).redirectUrl.replace("&amp;", "&");
                }
            }

            // Branch + repo details
            let branchDetails: PipelineStageEnriched["Branch"] = null;
            if (branchId) {
                const branchQuery = `SELECT Name, SourceCodeRepository.Name, SourceCodeRepository.Provider, SourceCodeRepository.RepositoryOwner FROM SourceCodeRepositoryBranch WHERE Id = '${branchId}'`;
                const branchResp = await axios.get(queryUrl, { headers, params: { q: branchQuery } });
                const branchRecords = branchResp.data?.records || [];
                if (branchRecords.length > 0) {
                    const b = branchRecords[0];
                    branchDetails = {
                        Name: b["Name"],
                        Repository: {
                            Name: b["SourceCodeRepository"]["Name"],
                            Provider: b["SourceCodeRepository"]["Provider"],
                            Owner: b["SourceCodeRepository"]["RepositoryOwner"]
                        }
                    };
                }
            }

            enrichedStages.push({
                Id: stageId,
                Name: stageName,
                DevOpsEnvironment: envId,
                SourceCodeRepositoryBranchId: branchId,
                Environment: envDetails,
                Branch: branchDetails
            });
        }

        // Development environments not yet part of the pipeline
        const devEnvQuery = `SELECT Id, Name, OrgType, IsDevEnvironment FROM DevopsEnvironment WHERE Id NOT IN (SELECT DevopsEnvironmentId FROM DevopsPipelineStage WHERE DevopsPipelineId = '${pipelineId}')`;
        const devEnvResp = await axios.get(queryUrl, { headers, params: { q: devEnvQuery } });
        const devEnvRecords = devEnvResp.data?.records || [];
        const devEnvironments: any[] = [];
        for (const rec of devEnvRecords) {
            const envId = rec["Id"];
            const envUrl = `${instanceUrl}/services/data/${apiVersion}/connect/devops/environment/${envId}`;
            const envResp = await axios.get(envUrl, { headers: { ...headers, "Content-Type": "application/json" } });
            const envDetails = envResp.data;
            if (envDetails && envDetails.redirectUrl) {
                envDetails.redirectUrl = envDetails.redirectUrl.replace("&amp;", "&");
            }
            devEnvironments.push(envDetails);
        }

        return {
            stages: enrichedStages,
            developmentEnvironments: devEnvironments
        };
    } catch (error: Error | any) {
        return {
            error: {
                message: error.message,
                ...(error.response && error.response.data ? { details: error.response.data } : {})
            }
        };
    }
}


