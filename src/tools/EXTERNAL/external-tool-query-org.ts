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
 * External tool logic for querying Salesforce orgs
 * This file contains only the pure business logic that can be exported to external repos
 */

import { type Connection } from '@salesforce/core';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Define the parameter schema for this external tool
export const queryOrgParamsSchema = z.object({
  query: z.string().describe('SOQL query to run'),
  useToolingApi: z
    .boolean()
    .optional()
    .default(false)
    .describe('Use Tooling API for the operation (default is false).'),
});

export type ExternalQueryOrgParams = z.infer<typeof queryOrgParamsSchema>;

// Description of the external tool
export const queryOrgDescription = 'Run a SOQL query against a Salesforce org.';

// Annotations for the external tool
// https://modelcontextprotocol.io/specification/2025-06-18/schema#toolannotations
export const queryOrgAnnotations = {
  title: 'Query Org',
  openWorldHint: false,
  readOnlyHint: true,
};

// Logic-only function that can be imported in external MCP Servers
export const queryOrgExecutable = async (
  params: ExternalQueryOrgParams,
  config: {
    connection: Connection;
  }
): Promise<CallToolResult> => {
  const { query, useToolingApi } = params;
  const { connection } = config;

  try {
    const result = useToolingApi ? await connection.tooling.query(query) : await connection.query(query);

    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: `SOQL query results:\n\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to query org: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
    };
  }
};
