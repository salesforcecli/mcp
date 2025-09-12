import { getConnection } from "../../shared/auth.js";
import { getPipelineIdForProject, fetchPipelineStages } from "../../shared/pipelineUtils.js";

export interface GetPipelineWithStagesResponse {
  pipeline?: { id: string; name?: string } | null;
  stages?: Array<{
    Id: string;
    Name?: string;
    NextStageId?: string | null;
    SourceCodeRepositoryBranch?: { Name?: string } | null;
  }> | null;
  error?: string;
}

export async function getPipelineWithStages(username: string, projectId: string): Promise<GetPipelineWithStagesResponse> {
  const connection = await getConnection(username);
  const pipelineId = await getPipelineIdForProject(connection, projectId);
  if (!pipelineId) {
    return { pipeline: null, stages: null, error: `No pipeline mapped to project ${projectId}` };
  }

  let pipelineName: string | undefined;
  try {
    const resp: unknown = await connection.query(`SELECT Id, Name FROM DevopsPipeline WHERE Id='${pipelineId}' LIMIT 1`);
    pipelineName = ((resp as any)?.records || [])[0]?.Name;
  } catch {
    // name is optional
  }

  const stages = await fetchPipelineStages(connection, pipelineId);
  return {
    pipeline: { id: pipelineId, name: pipelineName },
    stages
  };
}


