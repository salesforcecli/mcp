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

import { Org, StateAggregator, User } from '@salesforce/core';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';
import { textResponse } from '../../shared/utils.js';
import { getConnection } from '../../shared/auth.js';

/*
 * Assign permission set
 *
 * Assign a permission set to one or more org users.
 *
 * Parameters:
 * - permissionSetName: Permission set to assign (required)
 *   Example: "Set the permission set MyPermSet", "Set the perm set MyPermSet"
 * - usernameOrAlias: Username or alias for the Salesforce org (required)
 * - onBehalfOf: Username or alias to assign the permission set to (optional)
 *   Note: This is only used when "on behalf of" is explicitly mentioned.
 *   Otherwise, the permission will be set to the usernameOrAlias user.
 *   Example: "Set the permission set MyPermSet on behalf of my-alias"
 *
 * Returns:
 * - textResponse: Permission set assignment result
 */

export const assignPermissionSetParamsSchema = z.object({
  permissionSetName: z.string().describe(`A single permission set to assign

EXAMPLE USAGE:
Set the permission set MyPermSet
Set the perm set MyPermSet`),
  usernameOrAlias: usernameOrAliasParam,
  onBehalfOf: z.string().optional()
    .describe(`A single username or alias (other than the usernameOrAlias) to assign the permission set to

AGENT INSTRUCTIONS:
If the user does not specifically say "on behalf of" this will be empty.
If the user does specifically say "on behalf of", but it is unclear what the target-org is, run the #sf-get-username tool.
In that case, use the usernameOrAlias parameter as the org to assign the permission set to.

USAGE EXAMPLE:
Assign the permission set MyPermSet.
Set the permission set MyPermSet on behalf of test-3uyb8kmftiu@example.com.
Set the permission set MyPermSet on behalf of my-alias.`),
  directory: directoryParam,
});

export type AssignPermissionSetOptions = z.infer<typeof assignPermissionSetParamsSchema>;

export const registerToolAssignPermissionSet = (server: McpServer): void => {
  server.tool(
    'sf-assign-permission-set',
    'Assign a permission set to one or more org users.',
    assignPermissionSetParamsSchema.shape,
    async ({ permissionSetName, usernameOrAlias, onBehalfOf, directory }) => {
      try {
        if (!usernameOrAlias)
          return textResponse(
            'The usernameOrAlias parameter is required, if the user did not specify one use the #sf-get-username tool',
            true
          );
        process.chdir(directory);
        // We build the connection from the usernameOrAlias
        const connection = await getConnection(usernameOrAlias);

        // We need to clear the instance so we know we have the most up to date aliases
        // If a user sets an alias after server start up, it was not getting picked up
        StateAggregator.clearInstance();
        // Must NOT be nullish coalescing (??) In case the LLM uses and empty string
        const assignTo = (await StateAggregator.getInstance()).aliases.resolveUsername(onBehalfOf || usernameOrAlias);

        if (!assignTo.includes('@')) {
          return textResponse('Unable to resolve the username for alias. Make sure it is correct', true);
        }

        const org = await Org.create({ connection });
        const user = await User.create({ org });
        const queryResult = await connection.singleRecordQuery<{ Id: string }>(
          `SELECT Id FROM User WHERE Username='${assignTo}'`
        );

        await user.assignPermissionSets(queryResult.Id, [permissionSetName]);

        return textResponse(`Assigned ${permissionSetName} to ${assignTo}`);
      } catch (error) {
        return textResponse(
          `Failed to assign permission set: ${error instanceof Error ? error.message : 'Unknown error'}`,
          true
        );
      }
    }
  );
};
