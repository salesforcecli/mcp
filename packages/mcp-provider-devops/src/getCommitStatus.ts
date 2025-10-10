import axios from "axios";
import { getConnection } from "./shared/auth.js";

export interface CommitStatusResult {
  requestId: string;
  status: string;
  recordId?: string;
  message: string;
}

export async function fetchCommitStatus(username: string, requestId: string): Promise<CommitStatusResult> {
  if (!username || username.trim().length === 0) {
    throw new Error('Username is required. Please provide the DevOps Center org username.');
  }

  const connection = await getConnection(username);
  const accessToken = connection.accessToken;
  const instanceUrl = connection.instanceUrl;

  if (!accessToken || !instanceUrl) {
    throw new Error('Missing access token or instance URL. Please check if you are authenticated to the org.');
  }

  if (!requestId || requestId.trim().length === 0) {
    throw new Error('Request ID is required to check commit status.');
  }

  const soqlQuery = `SELECT Status FROM DevopsRequestInfo WHERE RequestToken = '${requestId}'`;
  const encodedQuery = encodeURIComponent(soqlQuery);
  const url = `${instanceUrl}/services/data/v65.0/query/?q=${encodedQuery}`;
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  try {
    const response = await axios.get(url, { headers });
    const records = response.data.records || [];

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
  } catch (error: any) {
    const errorMessage = error.response?.data?.[0]?.message || error.message;
    throw new Error(`Error checking commit status: ${errorMessage}`);
  }
}