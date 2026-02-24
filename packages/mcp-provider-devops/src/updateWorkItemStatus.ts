import axios from "axios";
import { getConnection } from "./shared/auth.js";
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
 * @param usernameOrAlias - DevOps Center org username or alias
 * @param workItemName - Exact Work Item Name (e.g. WI-00000001)
 * @param status - New status: "In Progress" or "Ready to Promote"
 */
export async function updateWorkItemStatus(
  usernameOrAlias: string,
  workItemName: string,
  status: WorkItemStatus
): Promise<UpdateWorkItemStatusResult> {
  const workItem = await fetchWorkItemByName(usernameOrAlias, workItemName);
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

  const connection = await getConnection(usernameOrAlias);
  const accessToken = connection.accessToken;
  const instanceUrl = connection.instanceUrl;
  if (!accessToken || !instanceUrl) {
    return {
      success: false,
      workItemName,
      status,
      error: "Missing access token or instance URL.",
    };
  }

  const url = `${instanceUrl}/services/data/${API_VERSION}/connect/devops/projects/${projectId}/workitem/${workItem.id}`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const statusApiValue = STATUS_TO_API_VALUE[status];
  const body = { status: statusApiValue };

  try {
    await axios.patch(url, body, { headers });
    return {
      success: true,
      workItemId: workItem.id,
      workItemName: workItem.name ?? workItemName,
      status,
    };
  } catch (error: any) {
    const data = error.response?.data;
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
