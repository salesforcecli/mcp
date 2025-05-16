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
import { getDefaultTargetOrg, getDefaultTargetDevHub, suggestUsername } from '../shared/auth.js';

/*
 * Suggest a username
 *
 * Suggest a username or alias for the Salesforce org.
 *
 * Parameters:
 * - None required
 *
 * Returns:
 * - textResponse: Suggested username, alias, and reason for choosing
 */

export const registerToolSuggestUsername = (server: McpServer): void => {
  server.tool(
    'sf-suggest-username',
    `Suggest a username or alias for the Salesforce org.

AGENT/LLM INSTRUCTIONS:
DO NOT use this tool if the users says something like "for my default org" or "for my the org 'an-alias'" or "for my test-prgelc2petd9@example.com org".
If it is not clear which username or alias is to be used, use this tool to try to determine which org a user wants.
The response of this tool should then be used as the usernameOrAlias param in the users original request.

EXAMPLE USAGE (notice how these are vague):
Do X for my org
Run X tool in my org`,
    {},
    async () => {
      try {
        const { aliasForReference, suggestedUsername, reasoning } = await suggestUsername();

        if (!suggestedUsername) {
          return textResponse(
            'No suggested org found. Please specify a username or alias. All check the MCP servers start up args for allowlisting orgs.'
          );
        }

        return textResponse(`
YOU MUST inform say that we are going to use "${suggestedUsername}" ${
          aliasForReference ? `(Alias: ${aliasForReference}) ` : ''
        }for the "usernameOrAlias" parameter.
YOU MUST explain the reasoning for selecting this org, which is: "${reasoning}".
AND THEN reconsider the user's ask and add this new parameter:
${JSON.stringify({ usernameOrAlias: suggestedUsername }, null, 2)}
Unless instructed otherwise, use this 'usernameOrAlias' for further user prompts.`);
      } catch (error) {
        return textResponse(`Failed to list orgs: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }
    }
  );
};

/*
 * List all Salesforce orgs
 *
 * Lists all configured Salesforce orgs.
 *
 * Parameters:
 * - None required
 *
 * Returns:
 * - textResponse: List of configured Salesforce orgs
 */

export const registerToolListAllOrgs = (server: McpServer): void => {
  server.tool(
    'sf-list-all-orgs',
    `Lists all configured Salesforce orgs.

AGENT INSTRUCTIONS:
Don't use this tool to try to determine which org a user wants, use #sf-suggest-username instead. Only use it if the user explicitly asks for a list of orgs.

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
        return textResponse(`Failed to list orgs: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }
    }
  );
};

/*
 * Get default Salesforce org
 *
 * Get the default Salesforce org configuration.
 *
 * Parameters:
 * - devHub: Force lookup of DevHub org (optional)
 *
 * Returns:
 * - textResponse: Default org configuration
 */

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
        return textResponse(
          `Failed to get default org: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        );
      }
    }
  );
};
