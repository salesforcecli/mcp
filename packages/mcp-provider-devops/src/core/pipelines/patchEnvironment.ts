import { getConnection } from "../../shared/auth.js";
import axios from "axios";

export interface PatchEnvironmentRequest {
  username: string;
  environmentId: string;
}

export interface PatchEnvironmentResponse {
  success?: boolean;
  statusCode?: number;
  data?: unknown;
  error?: {
    message: string;
    details?: unknown;
  };
}

export async function patchEnvironment(request: PatchEnvironmentRequest): Promise<PatchEnvironmentResponse> {
  const { username, environmentId } = request;
  try {
    const connection = await getConnection(username);
    const accessToken = connection.accessToken;
    const instanceUrl = connection.instanceUrl;

    if (!accessToken || !instanceUrl) {
      throw new Error("Missing access token or instance URL.");
    }

    const url = `${instanceUrl}/services/data/v65.0/connect/devops/environment/${encodeURIComponent(environmentId)}`;

    const response = await axios.patch(url, null, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      }
    });

    return {
      success: response.status >= 200 && response.status < 300,
      statusCode: response.status,
      data: response.data
    };
  } catch (error: Error | any) {
    return {
      error: {
        message: error.message,
        ...(error.response && error.response.data ? { details: error.response.data } : {})
      }
    };
  }
}


