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

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getAllAllowedOrgs } from '../shared/auth.js';
import { textResponse } from '../shared/utils.js';
import { getDefaultTargetOrg, getDefaultTargetDevHub } from '../shared/auth.js';

export const registerToolListAllOrgs = (server: McpServer): void => {
  server.tool(
    'sf-list-all-orgs',
    `Lists all configured Salesforce orgs.

AGENT INSTRUCTIONS:
Don't use this tool to try to determine which org a user wants. Only use it if the user explicitly asks for a list of orgs.

Example usage:
Can you list all Salesforce orgs for me
List all Salesforce orgs
List all orgs
`,
    {},
    async () => {
      try {
        const orgs = await getAllAllowedOrgs();
        return textResponse(`List of configured Salesforce orgs:\n\n${JSON.stringify(orgs, null, 2)}`);
      } catch (error) {
        return textResponse(`Failed to list orgs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );
};

export const getDefaultOrgParamsSchema = z.object({
  devHub: z.boolean().optional().default(false).describe(`Force lookup of DevHub org
AGENT INSTRUCTIONS:
Users may ask for a DevHub, dev hub, target-dev-hub, etc. Use this parameter only if the user explicitly asks for it.

USAGE EXAMPLE:
Get my default DevHub
...for my default dev hub
...for my default target-dev-hub`),
});

export type GetDefaultOrgParamsSchema = z.infer<typeof getDefaultOrgParamsSchema>;

export const registerToolGetDefaultOrg = (server: McpServer): void => {
  server.tool(
    'sf-get-default-org',
    `Get the default Salesforce org.

AGENT INSTRUCTIONS:
ALWAYS notify the user the following 3 pieces of information:
1. If it is target-org or target-dev-hub
2. The value of '.location' on the config
3. The value of '.value' on the config

EXAMPLE USAGE:
Can you get the default Salesforce org for me
Get the default Salesforce org
Get the global default org
...for the target org
...for the target dev hub`,
    getDefaultOrgParamsSchema.shape,
    async ({ devHub }) => {
      try {
        const defaultFromConfig = devHub ? await getDefaultTargetDevHub() : await getDefaultTargetOrg();
        if (!defaultFromConfig) {
          return textResponse(`No default ${devHub ? 'target-dev-hub' : 'target-org'} found`);
        }
        return textResponse(`Default org: ${JSON.stringify(defaultFromConfig, null, 2)}`);
      } catch (error) {
        return textResponse(`Failed to get default org: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  );
};
