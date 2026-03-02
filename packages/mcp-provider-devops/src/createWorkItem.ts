import { type Connection } from "@salesforce/core";

const API_VERSION = "v65.0";

export interface CreateWorkItemParams {
  connection: Connection;
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
 * Uses the provided Connection (e.g. from getOrgService().getConnection()).
 * API: POST /services/data/v65.0/connect/devops/projects/<ProjectID>/workitem
 * Body: { subject: string, description: string }
 */
export async function createWorkItem(params: CreateWorkItemParams): Promise<CreateWorkItemResult> {
  const { connection, projectId, subject, description } = params;

  const path = `/services/data/${API_VERSION}/connect/devops/projects/${projectId}/workitem`;
  const body = JSON.stringify({ subject, description: description ?? "" });

  try {
    const response = await connection.request({
      method: "POST",
      url: path,
      body,
      headers: { "Content-Type": "application/json" },
    });
    const data = (response as Record<string, unknown>) ?? {};
    return {
      success: true,
      workItemId: (data.id ?? data.Id) as string | undefined,
      workItemName: (data.name ?? data.Name) as string | undefined,
      subject: (data.subject ?? data.Subject ?? subject) as string,
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
      error: details ? `${message}: ${details}` : String(message),
    };
  }
}
