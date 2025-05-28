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

/* eslint-disable no-console */

import { z } from 'zod';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getConnection } from '../../shared/auth.js';
import { textResponse } from '../../shared/utils.js';
import { directoryParam, usernameOrAliasParam, useToolingApiParam } from '../../shared/params.js';

/*
 * Create a record in Salesforce
 *
 * Create and insert a record into a Salesforce or Tooling API object.
 *
 * Parameters:
 * - sobject: API name of the Salesforce or Tooling API object that you're inserting a record into (required)
 * - values: Values for the fields in the form <fieldName>=<value>, separate multiple pairs with spaces
 * - usernameOrAlias: username or alias for the Salesforce org to run the tool against
 * - useToolingApi: Use Tooling API to insert a record in a Tooling API object
 *
 * Returns:
 * - textResponse: Record creation result
 */

export const createRecordParamsSchema = z.object({
  sobject: z.string().describe("API name of the Salesforce or Tooling API object that you're inserting a record into"),
  values: z
    .string()
    .describe('Values for the fields in the form <fieldName>=<value>, separate multiple pairs with spaces'),
  usernameOrAlias: usernameOrAliasParam,
  useToolingApi: useToolingApiParam,
  directory: directoryParam,
});

export type CreateRecordOptions = z.infer<typeof createRecordParamsSchema>;

export const registerToolCreateRecord = (server: McpServer): void => {
  server.tool(
    'sf-create-record',
    'Create and insert a record into a Salesforce or Tooling API object.',
    createRecordParamsSchema.shape,
    async ({ sobject, values, usernameOrAlias, useToolingApi, directory }) => {
      try {
        process.chdir(directory);
        const connection = await getConnection(usernameOrAlias);

        // Parse the values string into a dictionary of field-value pairs
        const valuesObj: Record<string, string> = {};
        // Split by spaces, but respect single quotes for values with spaces
        const regex = /([^=\s]+)=(?:'([^']*)'|([^\s]*))/g;
        let match;
        while ((match = regex.exec(values)) !== null) {
          const key = match[1];
          // Use the quoted value if it exists, otherwise use the unquoted value
          const value = match[2] ?? match[3];
          valuesObj[key] = value;
        }

        // Get the appropriate API (standard or tooling)
        const api = useToolingApi ? connection.tooling : connection;

        // Create the record
        const result = await api.sobject(sobject).create(valuesObj);

        if (result.success) {
          return textResponse(
            `Successfully created record in ${sobject} for ${usernameOrAlias}:\n\nRecord ID: ${result.id}`
          );
        } else {
          const errors = Array.isArray(result.errors) ? result.errors.join(', ') : 'Unknown error';
          return textResponse(`Failed to create record: ${errors}`, true);
        }
      } catch (error) {
        return textResponse(
          `Failed to create record: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        );
      }
    }
  );
};
