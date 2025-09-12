import type { WorkItem } from "../../types/WorkItem.js";
import { getPipelineIdForProject, fetchPipelineStages, resolveTargetStageId, findStageById, getBranchNameFromStage, computeFirstStageId } from "../../shared/pipelineUtils.js";
import { getConnection } from "../../shared/auth.js";

export async function getWorkItemWithTargetBranch(
  request: { username: string; workItem: WorkItem }
): Promise<WorkItem | any> {
  const { username, workItem } = request;
  try {
    // Determine DevOps Project Id from workItem
    const projectId: string | undefined = (workItem as any)?.DevopsProjectId || (workItem as any)?.ProjectId;
    if (!projectId) {
      return {
        error: {
          message: "DevOps Project Id not found on work item (expected DevopsProjectId or ProjectId).",
        }
      };
    }

    const connection = await getConnection(username);
    const pipelineId: string | undefined = await getPipelineIdForProject(connection, projectId);

    if (!pipelineId) return workItem;

    const stages = await fetchPipelineStages(connection, pipelineId);

    let targetStageId = resolveTargetStageId((workItem as any)?.PipelineStageId, stages);
    if (!targetStageId) {
      targetStageId = computeFirstStageId(stages);
    }

    const targetStage = findStageById(stages, targetStageId);
    const targetBranch: string | undefined = getBranchNameFromStage(targetStage);

    const updatedWorkItem: WorkItem = {
      ...workItem,
      TargetBranch: targetBranch || workItem.TargetBranch
    };

    return updatedWorkItem;
  } catch (error: Error | any) {
    return error;
  }
}