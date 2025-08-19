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

import { getConnection } from '../../shared/auth.js';
import { textResponse } from '../../shared/utils.js';
import { directoryParam, usernameOrAliasParam, useToolingApiParam } from '../../shared/params.js';
import { SfMcpServer } from '../../sf-mcp-server.js';

export const queryOrgParamsSchema = z.object({
  query: z.string().describe('SOQL query to run'),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
  useToolingApi: useToolingApiParam,
});

export type QueryOrgOptions = z.infer<typeof queryOrgParamsSchema>;

export const queryOrg = (server: SfMcpServer): void => {
  server.tool(
    'sf-query-org',
    'Run a SOQL query against a Salesforce org.',
    queryOrgParamsSchema.shape,
    {
      title: 'Query Org',
      openWorldHint: false,
      readOnlyHint: true,
    },
    async ({ query, usernameOrAlias, directory, useToolingApi }) => {
      try {
        if (!usernameOrAlias)
          return textResponse(
            'The usernameOrAlias parameter is required, if the user did not specify one use the #sf-get-username tool',
            true
          );
        process.chdir(directory);
        const connection = await getConnection(usernameOrAlias);
        const result = useToolingApi ? await connection.tooling.query(query) : await connection.query(query);

        return textResponse(`SOQL query results:\n\n${JSON.stringify(result, null, 2)}`);
      } catch (error) {
        let errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.endsWith('is not supported.')) {
          if (useToolingApi) {
            errorMessage += '\nTry not using the Tooling API for this query.';
          } else {
            errorMessage += '\nTry using the Tooling API for this query.';
          }
        }

        return textResponse(`Failed to query org: ${errorMessage}`, true);
      }
    }
  );
};
