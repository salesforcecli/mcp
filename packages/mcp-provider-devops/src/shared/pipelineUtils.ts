import type { Connection } from "@salesforce/core";

export interface PipelineStageRecord {
  Id: string;
  Name?: string;
  NextStageId?: string | null;
  SourceCodeRepositoryBranch?: { Name?: string } | null;
}

export async function getPipelineIdForProject(connection: Connection, projectId: string): Promise<string | undefined> {
  const query = `SELECT DevopsPipelineId FROM DevopsProjectPipeline WHERE DevopsProjectId = '${projectId}' LIMIT 1`;
  const result: any = await connection.query(query);
  return (result?.records || [])[0]?.DevopsPipelineId;
}

export async function fetchPipelineStages(connection: Connection, pipelineId: string): Promise<PipelineStageRecord[]> {
  const stageQuery = `SELECT Id, Name, NextStageId, SourceCodeRepositoryBranch.Name FROM DevopsPipelineStage WHERE DevopsPipelineId = '${pipelineId}'`;
  const stageResult: any = await connection.query(stageQuery);
  return (stageResult?.records || []) as PipelineStageRecord[];
}

export function computeFirstStageId(stages: PipelineStageRecord[]): string | undefined {
  const allStageIds = new Set<string>(stages.map(s => s.Id));
  const nextStageIds = new Set<string>((stages.map(s => s.NextStageId).filter(Boolean)) as string[]);
  const firstStageIds: string[] = Array.from(allStageIds).filter(id => !nextStageIds.has(id));
  if (firstStageIds.length !== 1) return undefined;
  return firstStageIds[0];
}

export function resolveTargetStageId(currentStageId: string | undefined, stages: PipelineStageRecord[]): string | undefined {
  if (!stages.length) return undefined;
  if (currentStageId) {
    const current = stages.find(s => s.Id === currentStageId);
    return current?.NextStageId || undefined;
  }
  return undefined;
}

export function findStageById(stages: PipelineStageRecord[], stageId: string | undefined): PipelineStageRecord | undefined {
  if (!stageId) return undefined;
  return stages.find(s => s.Id === stageId);
}

export function getBranchNameFromStage(stage: PipelineStageRecord | undefined): string | undefined {
  return stage?.SourceCodeRepositoryBranch?.Name || undefined;
}
