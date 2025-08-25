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
import { McpTool, McpToolConfig, Services, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { textResponse } from '../shared/utils.js';
import { directoryParam, usernameOrAliasParam, useToolingApiParam } from '../shared/params.js';

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

const queryOrgParamsSchema = z.object({
  query: z.string().describe('SOQL query to run'),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
  useToolingApi: useToolingApiParam,
});

type InputArgs = z.infer<typeof queryOrgParamsSchema>;
type InputArgsShape = typeof queryOrgParamsSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class QueryOrgMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public constructor(private readonly services: Services) {
    super();
  }

  public getToolsets(): Toolset[] {
    return [Toolset.DATA];
  }

  public getName(): string {
    return 'sf-query-org';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Query Org',
      description: 'Run a SOQL query against a Salesforce org.',
      inputSchema: queryOrgParamsSchema.shape,
      outputSchema: undefined,
      annotations: {
        openWorldHint: false,
        readOnlyHint: true,
      },
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      if (!input.usernameOrAlias)
        return textResponse(
          'The usernameOrAlias parameter is required, if the user did not specify one use the #sf-get-username tool',
          true
        );
      process.chdir(input.directory);
      const connection = await this.services.getOrgService().getConnection(input.usernameOrAlias);
      const result = input.useToolingApi
        ? await connection.tooling.query(input.query)
        : await connection.query(input.query);

      return textResponse(`SOQL query results:\n\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.endsWith('is not supported.')) {
        if (input.useToolingApi) {
          errorMessage += '\nTry not using the Tooling API for this query.';
        } else {
          errorMessage += '\nTry using the Tooling API for this query.';
        }
      }

      return textResponse(`Failed to query org: ${errorMessage}`, true);
    }
  }
}
