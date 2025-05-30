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

/*
 * Query Salesforce org
 *
 * Run a SOQL query against a Salesforce org.
 *
 * Parameters:
 * - query: SOQL query to run (required)
 * - usernameOrAlias: username or alias for the Salesforce org to run the query against
 *
 * Returns:
 * - textResponse: SOQL query results
 */

import { z } from 'zod';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConnection } from '../../shared/auth.js';
import { textResponse } from '../../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';

export const queryOrgParamsSchema = z.object({
  query: z.string().describe('SOQL query to run'),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

export type QueryOrgOptions = z.infer<typeof queryOrgParamsSchema>;

export const registerToolQueryOrg = (server: McpServer): void => {
  server.tool(
    'sf-query-org',
    'Run a SOQL query against a Salesforce org.',
    queryOrgParamsSchema.shape,
    async ({ query, usernameOrAlias, directory }) => {
      try {
        process.chdir(directory);
        const connection = await getConnection(usernameOrAlias);
        const result = await connection.query(query);

        return textResponse(`SOQL query results:\n\n${JSON.stringify(result, null, 2)}`);
      } catch (error) {
        return textResponse(`Failed to query org: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
      }
    }
  );
};
