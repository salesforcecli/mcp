/*
 * Copyright 2026, Salesforce, Inc.
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
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { textResponse } from '../shared/utils.js';
import { directoryParam, usernameOrAliasParam, useToolingApiParam } from '../shared/params.js';
import {
  DEFAULT_MAX_SOQL_RECORDS,
  formatSoqlQueryResult,
} from '../shared/queryResultFormat.js';

/*
 * Query Salesforce org
 *
 * Run a SOQL query against a Salesforce org.
 *
 * Parameters:
 * - query: SOQL query to run (required)
 * - usernameOrAlias: username or alias for the Salesforce org to run the query against
 * - maxRecords: optional cap on records returned to the MCP client (default 100)
 *
 * Returns:
 * - textResponse: SOQL query results (may be truncated for large datasets)
 */

export const queryOrgParamsSchema = z.object({
  query: z.string().describe('SOQL query to run. Prefer selective fields and LIMIT for large objects.'),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
  useToolingApi: useToolingApiParam,
  maxRecords: z
    .number()
    .int()
    .positive()
    .max(2000)
    .optional()
    .describe(
      `Maximum number of records to return to the MCP client (default ${DEFAULT_MAX_SOQL_RECORDS}). Use a smaller LIMIT in SOQL when possible.`,
    ),
});

type InputArgs = z.infer<typeof queryOrgParamsSchema>;
type InputArgsShape = typeof queryOrgParamsSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class QueryOrgMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public constructor(private readonly services: Services) {
    super();
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.DATA];
  }

  public getName(): string {
    return 'run_soql_query';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Query Org',
      description: `Run a SOQL query against a Salesforce org.

AGENT INSTRUCTIONS:
- Prefer selective fields and LIMIT for large objects.
- If the tool response says TRUNCATED, do NOT re-run the identical SOQL. Narrow with WHERE/LIMIT or fewer fields instead.`,
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
          'The usernameOrAlias parameter is required, if the user did not specify one use the #get_username tool',
          true,
        );
      process.chdir(input.directory);
      const connection = await this.services.getOrgService().getConnection(input.usernameOrAlias);
      const result = input.useToolingApi
        ? await connection.tooling.query(input.query)
        : await connection.query(input.query);

      return textResponse(
        formatSoqlQueryResult(result, { maxRecords: input.maxRecords ?? DEFAULT_MAX_SOQL_RECORDS }),
      );
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
