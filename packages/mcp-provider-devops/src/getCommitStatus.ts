import axios from "axios";
import { getConnection } from "./shared/auth.js";

export interface CommitStatusResult {
  requestId: string;
  status: string;
  recordId?: string;
  message: string;
}

export async function fetchCommitStatus(username: string, requestId: string): Promise<CommitStatusResult> {
  const connection = await getConnection(username);
  const query = `SELECT Id, Status__c, RequestToken__c FROM DevopsRequestInfo WHERE RequestToken__c = '${requestId}' LIMIT 1`;

  const response = await axios.get(`${connection.instanceUrl}/services/data/v65.0/query`, {
    headers: {
      'Authorization': `Bearer ${connection.accessToken}`,
      'Content-Type': 'application/json'
    },
    params: { q: query }
  });

  if (response.data.records && response.data.records.length > 0) {
    const record = response.data.records[0];
    return {
      requestId,
      status: record.Status__c,
      recordId: record.Id,
      message: `Request ${requestId} has status: ${record.Status__c}`
    };
  }

  return {
    requestId,
    status: 'NOT_FOUND',
    message: `No record found for request ID: ${requestId}`
  };
}


