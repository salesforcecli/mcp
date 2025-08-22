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
import { AuthRemover, Org } from '@salesforce/core';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpTool, McpToolConfig, Toolset } from '@salesforce/mcp-provider-api';
import { textResponse } from '../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../shared/params.js';

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

const deleteOrgParams = z.object({
  directory: directoryParam,
  usernameOrAlias: usernameOrAliasParam,
});

type InputArgs = z.infer<typeof deleteOrgParams>;
type InputArgsShape = typeof deleteOrgParams.shape;
type OutputArgsShape = z.ZodRawShape;

export class DeleteOrgMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public getToolsets(): Toolset[] {
    return [Toolset.EXPERIMENTAL];
  }

  public getName(): string {
    return 'sf-delete-org';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Delete an Org',
      description: `Deletes specified salesforce org.

AGENT INSTRUCTIONS:
ALWAYS confirm with the user before deleting an org

Example usage:
Can you delete my org
Can you delete MyAliasedOrg
Can you delete test-fe2n4tc8pgku@example.com`,
      inputSchema: deleteOrgParams.shape,
      outputSchema: undefined,
      annotations: {},
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      process.chdir(input.directory);
      const org = await Org.create({ aliasOrUsername: input.usernameOrAlias });
      await org.delete();
      return textResponse(`Successfully deleted ${input.usernameOrAlias}`);
    } catch (e) {
      if (e instanceof Error && e.name === 'DomainNotFoundError') {
        // the org has expired, so remote operations won't work
        // let's clean up the files locally
        const authRemover = await AuthRemover.create();
        await authRemover.removeAuth(input.usernameOrAlias);
        return textResponse(`Successfully deleted ${input.usernameOrAlias}`);
      }
      return textResponse(`Failed to delete org: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
    }
  }
}
