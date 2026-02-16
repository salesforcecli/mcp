import axios from "axios";
import { getConnection } from "./shared/auth.js";

const API_VERSION = "v65.0";

export interface CreateWorkItemParams {
  usernameOrAlias: string;
  projectId: string;
  subject: string;
  description: string;
}

export interface CreateWorkItemResult {
  success: boolean;
  workItemId?: string;
  workItemName?: string;
  subject?: string;
  error?: string;
}

/**
 * Creates a new DevOps Center Work Item in the specified project.
 * API: POST /services/data/v65.0/connect/devops/projects/<ProjectID>/workitem
 * Body: { subject: string, description: string }
 */
export async function createWorkItem(params: CreateWorkItemParams): Promise<CreateWorkItemResult> {
  const { usernameOrAlias, projectId, subject, description } = params;

  const connection = await getConnection(usernameOrAlias);
  const accessToken = connection.accessToken;
  const instanceUrl = connection.instanceUrl;
  if (!accessToken || !instanceUrl) {
    return {
      success: false,
      error: "Missing access token or instance URL.",
    };
  }

  const url = `${instanceUrl}/services/data/${API_VERSION}/connect/devops/projects/${projectId}/workitem`;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };
  const body = { subject, description };

  try {
    const response = await axios.post(url, body, { headers });
    const data = response.data ?? {};
    return {
      success: true,
      workItemId: data.id ?? data.Id,
      workItemName: data.name ?? data.Name,
      subject: data.subject ?? data.Subject ?? subject,
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
      error: details ? `${message}: ${details}` : String(message),
    };
  }
}
