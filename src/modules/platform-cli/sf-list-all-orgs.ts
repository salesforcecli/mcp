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
import { getAllAllowedOrgs } from '../../shared/auth.js';
import { textResponse } from '../../shared/utils.js';
import { directoryParam } from '../../shared/params.js';

/*
 * List all Salesforce orgs
 *
 * Lists all configured Salesforce orgs.
 *
 * Parameters:
 * - directory: directory to change to before running the command
 *
 * Returns:
 * - textResponse: List of configured Salesforce orgs
 */

export const listAllOrgsParamsSchema = z.object({
  directory: directoryParam,
});

export type ListAllOrgsOptions = z.infer<typeof listAllOrgsParamsSchema>;

export const registerToolListAllOrgs = (server: McpServer): void => {
  server.tool(
    'sf-list-all-orgs',
    `Lists all configured Salesforce orgs.

AGENT INSTRUCTIONS:
DO NOT use this tool to try to determine which org a user wants, use #sf-get-username instead. Only use it if the user explicitly asks for a list of orgs.

Example usage:
Can you list all Salesforce orgs for me
List all Salesforce orgs
List all orgs
`,
    listAllOrgsParamsSchema.shape,
    {
      title: 'List All Orgs',
      readOnlyHint: true,
      openWorldHint: false,
    },
    async ({ directory }) => {
      try {
        process.chdir(directory);
        const orgs = await getAllAllowedOrgs();
        return textResponse(`List of configured Salesforce orgs:\n\n${JSON.stringify(orgs, null, 2)}`);
      } catch (error) {
        return textResponse(`Failed to list orgs: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }
    }
  );
};
