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
import { textResponse } from '../../shared/utils.js';
import { getDefaultTargetOrg, getDefaultTargetDevHub, suggestUsername } from '../../shared/auth.js';
import { directoryParam } from '../../shared/params.js';
import { type ConfigInfoWithCache, type ToolTextResponse } from '../../shared/types.js';
import { SfMcpServer } from '../../sf-mcp-server.js';

/*
 * Get username for Salesforce org
 *
 * Intelligently determines the appropriate username or alias for Salesforce operations.
 *
 * Parameters:
 * - defaultTargetOrg: Force lookup of default target org (optional)
 * - defaultDevHub: Force lookup of default dev hub (optional)
 * - directory: The directory to run this tool from
 *
 * Returns:
 * - textResponse: Username/alias and org configuration
 */

export const getUsernameParamsSchema = z.object({
  defaultTargetOrg: z.boolean().optional().default(false).describe(`Try to find default org
AGENT INSTRUCTIONS:
ONLY SET TO TRUE when the user explicitly asks for the default org or default target org.
Leave it as false when the user is vague and says something like "for my org" or "for my-alias".

USAGE EXAMPLE:
Get username for my default org
...for my default target org`),
  defaultDevHub: z.boolean().optional().default(false).describe(`Try to find default dev hub
AGENT INSTRUCTIONS:
ONLY SET TO TRUE when the user explicitly asks for the default dev hub or default target devhub.
Leave it as false when the user is vague and says something like "for my org" or "for my-alias".

USAGE EXAMPLE:
Get username for my default dev hub
...for my default target dev hub
...for my default devhub`),
  directory: directoryParam,
});

export type GetUsernameParamsSchema = z.infer<typeof getUsernameParamsSchema>;

export const getUsername = (server: SfMcpServer): void => {
  server.tool(
    'sf-get-username',
    `Intelligently determines the appropriate username or alias for Salesforce operations.

AGENT/LLM INSTRUCTIONS:
Use this tool when uncertain which username/org a user wants for Salesforce operations.
This tool handles three distinct scenarios:

1. When defaultTargetOrg=true: Fetches the default target org configuration
   - Use when user says "for my default org" or "for my default target org"

2. When defaultDevHub=true: Fetches the default dev hub configuration
   - Use when user says "for my default dev hub" or "for my default target dev hub"

3. When both are false (default): Uses suggestUsername to intelligently determine the appropriate org
   - Use when user is vague and says something like "for my org" or doesn't specify

EXAMPLE USAGE:
- When user says "Do X for my org" → defaultTargetOrg=false, defaultDevHub=false
- When user says "For my default org" → defaultTargetOrg=true
- When user says "For my default dev hub" → defaultDevHub=true`,
    getUsernameParamsSchema.shape,
    {
      title: 'Get Username',
      readOnlyHint: true,
      openWorldHint: false,
    },
    async ({ defaultTargetOrg, defaultDevHub, directory }) => {
      try {
        process.chdir(directory);

        const generateResponse = (defaultFromConfig: ConfigInfoWithCache | undefined): ToolTextResponse =>
          textResponse(`ALWAYS notify the user the following 3 (maybe 4) pieces of information:
1. If it is default target-org or target-dev-hub ('.key' on the config)
2. The value of '.location' on the config
3. The value of '.value' on the config
4. IF '.cached' IS TRUE, tell then we are using a cached value and if they have changed it, restart the MCP Server

- Full config: ${JSON.stringify(defaultFromConfig, null, 2)}

UNLESS THE USER SPECIFIES OTHERWISE, use this username for the "usernameOrAlias" parameter in future Tool calls.`);

        // Case 1: User explicitly asked for default target org
        if (defaultTargetOrg) return generateResponse(await getDefaultTargetOrg());

        // Case 2: User explicitly asked for default dev hub
        if (defaultDevHub) return generateResponse(await getDefaultTargetDevHub());

        // Case 3: User was vague, so suggest a username
        const { aliasForReference, suggestedUsername, reasoning } = await suggestUsername();

        if (!suggestedUsername) {
          return textResponse(
            "No suggested username found. Please specify a username or alias explicitly. Also check the MCP server's startup args for allowlisting orgs.",
            true
          );
        }

        return textResponse(`
YOU MUST inform the user that we are going to use "${suggestedUsername}" ${
          aliasForReference ? `(Alias: ${aliasForReference}) ` : ''
        }for the "usernameOrAlias" parameter.
YOU MUST explain the reasoning for selecting this org, which is: "${reasoning}"
UNLESS THE USER SPECIFIES OTHERWISE, use this username for the "usernameOrAlias" parameter in future Tool calls.`);
      } catch (error) {
        return textResponse(
          `Failed to determine appropriate username: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        );
      }
    }
  );
};
