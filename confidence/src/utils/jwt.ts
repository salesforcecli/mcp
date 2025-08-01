/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const mintJWT = async (): Promise<string> => {
  const consumerKey = process.env.SF_MCP_CONFIDENCE_CONSUMER_KEY;
  const consumerSecret = process.env.SF_MCP_CONFIDENCE_CONSUMER_SECRET;
  const instanceUrl = process.env.SF_MCP_CONFIDENCE_INSTANCE_URL;

  if (!consumerKey || !consumerSecret || !instanceUrl) {
    throw new Error(
      'Missing required environment variables: SF_MCP_CONFIDENCE_CONSUMER_KEY, SF_MCP_CONFIDENCE_CONSUMER_SECRET, or SF_MCP_CONFIDENCE_INSTANCE_URL'
    );
  }

  const response = await fetch(`${instanceUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: consumerKey,
      client_secret: consumerSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to mint JWT: ${response.statusText}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Failed to retrieve access token from response');
  }

  return data.access_token;
};
