import { type Connection } from "@salesforce/core";

export interface CommitStatusResult {
  requestId: string;
  status: string;
  recordId?: string;
  message: string;
}

/**
 * Fetches commit status by request ID using the provided Connection (e.g. from getOrgService().getConnection()).
 */
export async function fetchCommitStatus(connection: Connection, requestId: string): Promise<CommitStatusResult> {
  if (!requestId || requestId.trim().length === 0) {
    throw new Error('Request ID is required to check commit status.');
  }

  const soqlQuery = `SELECT Id, Status FROM DevopsRequestInfo WHERE RequestToken = '${requestId}'`;
  const result = await connection.query<{ Id: string; Status: string }>(soqlQuery);
  const records = result?.records ?? [];

  if (records.length === 0) {
    return {
      requestId,
      status: 'NOT_FOUND',
      message: `No commit status found for request ID: ${requestId}`
    };
  }

  const status = records[0].Status;
  return {
    requestId,
    status,
    recordId: records[0].Id,
    message: `Commit status for request ID ${requestId}: ${status}`
  };
}