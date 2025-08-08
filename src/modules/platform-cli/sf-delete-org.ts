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
import { AuthRemover, Org } from '@salesforce/core';
import { textResponse } from '../../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';

/*
 * Delete a locally authorized Salesforce org
 *
 * Parameters:
 * - directory: directory to change to before running the command
 * - usernameOrAlias: Username or alias of the Salesforce org to delete.
 *
 * Returns:
 * - textResponse: Deletion request response
 */

export const deleteOrgParams = z.object({
  directory: directoryParam,
  usernameOrAlias: usernameOrAliasParam,
});

export type DeleteOrgOptions = z.infer<typeof deleteOrgParams>;

export const deleteOrg = (server: McpServer): void => {
  server.tool(
    'sf-delete-org',
    `Deletes specified salesforce org.

AGENT INSTRUCTIONS:
ALWAYS confirm with the user before deleting an org

Example usage:
Can you delete my org
Can you delete MyAliasedOrg
Can you delete test-fe2n4tc8pgku@example.com
`,
    deleteOrgParams.shape,
    {
      title: 'Delete an Org',
    },
    async ({ directory, usernameOrAlias }) => {
      try {
        process.chdir(directory);
        const org = await Org.create({ aliasOrUsername: usernameOrAlias });
        await org.delete();
        return textResponse(`Successfully deleted ${usernameOrAlias}`);
      } catch (e) {
        if (e instanceof Error && e.name === 'DomainNotFoundError') {
          // the org has expired, so remote operations won't work
          // let's clean up the files locally
          const authRemover = await AuthRemover.create();
          await authRemover.removeAuth(usernameOrAlias);
          return textResponse(`Successfully deleted ${usernameOrAlias}`);
        }
        return textResponse(`Failed to delete org: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
      }
    }
  );
};
