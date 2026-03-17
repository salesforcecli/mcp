import { type Connection } from "@salesforce/core";
import { fetchWorkItemByName } from "./getWorkItems.js";

export type WorkItemStatus = "In Progress" | "Ready to Promote";

/** Map user-facing labels to API values for the devops REST API body. */
const STATUS_TO_API_VALUE: Record<WorkItemStatus, string> = {
  "In Progress": "IN_PROGRESS",
  "Ready to Promote": "READY_TO_PROMOTE",
};

export interface UpdateWorkItemStatusResult {
  success: boolean;
  workItemId?: string;
  workItemName?: string;
  status?: WorkItemStatus;
  error?: string;
}

const API_VERSION = "v65.0";

/**
 * Updates the Status field of a DevOps Center Work Item via the devops REST API.
 * Uses the provided Connection (e.g. from getOrgService().getConnection()).
 * @param connection - Salesforce connection from getOrgService().getConnection()
 * @param workItemName - Exact Work Item Name (e.g. WI-00000001)
 * @param status - New status: "In Progress" or "Ready to Promote"
 */
export async function updateWorkItemStatus(
  connection: Connection,
  workItemName: string,
  status: WorkItemStatus
): Promise<UpdateWorkItemStatusResult> {
  const workItem = await fetchWorkItemByName(connection, workItemName);
  if (!workItem?.id) {
    return {
      success: false,
      workItemName,
      status,
      error: `Work Item not found: ${workItemName}`,
    };
  }

  const projectId = workItem.DevopsProjectId;
  if (!projectId) {
    return {
      success: false,
      workItemName,
      status,
      error: `Work item ${workItemName} has no project (DevopsProjectId).`,
    };
  }

  const path = `/services/data/${API_VERSION}/connect/devops/projects/${projectId}/workitem/${workItem.id}`;
  const statusApiValue = STATUS_TO_API_VALUE[status];
  const body = JSON.stringify({ status: statusApiValue });

  try {
    await connection.request({
      method: "PATCH",
      url: path,
      body,
      headers: { "Content-Type": "application/json" },
    });
    return {
      success: true,
      workItemId: workItem.id,
      workItemName: workItem.name ?? workItemName,
      status,
    };
  } catch (error: any) {
    const data = error.response?.data ?? error.body ?? error;
    const message =
      (typeof data === "object" && (data?.message ?? data?.error ?? data?.errorDescription)) ??
      error.message ??
      "Unknown error";
    const details = Array.isArray(data?.body) ? data.body.join("; ") : undefined;
    return {
      success: false,
      workItemName,
      status,
      error: details ? `${message}: ${details}` : String(message),
    };
  }
}
