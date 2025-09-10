import { getConnection } from "../../shared/auth.js";
import axios from "axios";

export interface PipelineStageConfig {
    name: string;
    branch: string;
    environment: string;
}

export interface PipelineConfig {
    username: string;
    pipeline_name: string;
    repo_url: string;
    stages?: PipelineStageConfig[];
}

export interface CreatePipelineResponse {
    id?: string;
    success?: boolean;
    error?: {
        message: string;
        details?: unknown;
    };
}

const DEFAULT_STAGES: PipelineStageConfig[] = [
    { name: "Integration", branch: "integration", environment: "IntEnv" },
    { name: "UAT", branch: "uat", environment: "UATEnv" },
    { name: "Staging", branch: "staging", environment: "StagingEnv" }
];

export async function createPipeline(config: PipelineConfig): Promise<CreatePipelineResponse> {
    const { username, pipeline_name, repo_url, stages } = config;

    if (!pipeline_name || !repo_url) {
        return {
            error: {
                message: "pipeline_name and repo_url are required"
            }
        };
    }

    try {
        const connection = await getConnection(username);
        const accessToken = connection.accessToken;
        const instanceUrl = connection.instanceUrl;

        if (!accessToken || !instanceUrl) {
            throw new Error("Missing access token or instance URL.");
        }

        const url = `${instanceUrl}/services/data/v65.0/connect/devops/pipelines`;

        const body = {
            name: pipeline_name,
            vcsType: "github",
            vcsRepoUrl: repo_url,
            stages: (stages && stages.length > 0 ? stages : DEFAULT_STAGES).map(s => ({
                name: s.name,
                branch: s.branch,
                environment: s.environment
            }))
        };

        const response = await axios.post(url, body, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            }
        });

        return {
            id: response.data?.id || response.data?.Id,
            success: true
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


