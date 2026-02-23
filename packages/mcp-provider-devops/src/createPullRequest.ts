import { type Connection } from '@salesforce/core';

/** Minimal request interface for Connection.request() (auth/URL handled by Connection). */
type ConnectionRequest = (options: {
  method: string;
  url: string;
  body?: string;
  headers?: Record<string, string>;
}) => Promise<unknown>;

const API_VERSION = 'v65.0';

/**
 * Creates a pull request for a work item using the provided Connection.
 * API: POST /services/data/v65.0/connect/devops/workItems/<workItemId>/review
 */
export async function createPullRequest(connection: Connection, workItemId: string): Promise<any> {
  if (!workItemId) {
    throw new Error('Work item ID is required to create pull request.');
  }

  const path = `/services/data/${API_VERSION}/connect/devops/workItems/${workItemId}/review`;
  try {
    const response = await (connection as unknown as { request: ConnectionRequest }).request({
      method: 'POST',
      url: path,
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' }
    });
    return {
      success: true,
      pullRequestResult: response ?? {},
      message: 'Pull request created successfully',
      workItemId
    };
  } catch (error: any) {
    const data = error.response?.data ?? error.body ?? error;
    const errorMessage = (typeof data === 'object' && data?.message) || error.message;
    throw new Error(`Failed to create pull request: ${errorMessage}`);
  }
}