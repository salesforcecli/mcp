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
import { Org } from '@salesforce/core';
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { textResponse } from '../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../shared/params.js';

/*
 * Create a new scratch org snapshot
 *
 * Parameters:
 * - directory: directory to change to before running the command
 * - devHub: Username or alias of the Dev Hub org
 * - sourceOrg: ID or locally authenticated username or alias of scratch org to snapshot.
 * - description: a description given to the snapshot
 * - name: Unique name of snapshot
 * Returns:
 * - textResponse:
 */

const createOrgSnapshotParams = z.object({
  directory: directoryParam,
  devHub: usernameOrAliasParam.describe(
    'The default devhub username, use the #sf-get-username tool to get the default devhub if unsure'
  ),
  sourceOrg: usernameOrAliasParam.describe(
    'The org username or alias to create a snapshot of, use the #sf-get-username tool to get the default target org if unsure'
  ),
  description: z.string().describe(' Description of snapshot.').optional(),
  name: z.string().describe('Unique name of snapshot').max(15).default(Date.now().toString().substring(0, 15)),
});

type InputArgs = z.infer<typeof createOrgSnapshotParams>;
type InputArgsShape = typeof createOrgSnapshotParams.shape;
type OutputArgsShape = z.ZodRawShape;

export class CreateOrgSnapshotMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public constructor(private readonly services: Services) {
    super();
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.ORGS];
  }

  public getName(): string {
    return 'sf-create-org-snapshot';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Create a new snapshot',
      description: `Creates a new snapshot of an org

AGENT INSTRUCTIONS:

Example usage:
Create a snapshot called 07042025
create a snapshot called 07042025 with the description, "this is a snapshot for commit 5b1a09b1743 - new login flow working"
create a snapshot of my MyScratch in myDevHub`,
      inputSchema: createOrgSnapshotParams.shape,
      outputSchema: undefined,
      annotations: {},
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      process.chdir(input.directory);

      const sourceOrgId = (await Org.create({ aliasOrUsername: input.sourceOrg })).getOrgId();
      const devHubConnection = await this.services.getOrgService().getConnection(input.devHub);
      const createResponse = await devHubConnection.sobject('OrgSnapshot').create({
        SourceOrg: sourceOrgId,
        Description: input.description,
        SnapshotName: input.name,
        Content: 'metadatadata',
      });

      if (createResponse.success === false) {
        return textResponse(`An error while created the org snapshot: ${JSON.stringify(createResponse)}`, true);
      }
      const result = await devHubConnection.singleRecordQuery(`SELECT Id,
              SnapshotName,
              Description,
              Status,
              SourceOrg,
              CreatedDate,
              LastModifiedDate,
              ExpirationDate,
              Error FROM OrgSnapshot WHERE Id = '${createResponse.id}'`);

      return textResponse(`Successfully created the org snapshot: ${JSON.stringify(result)}`);
    } catch (error) {
      const e = error as Error;
      // dev hub does not have snapshot pref enabled
      if (e.name === 'NOT_FOUND') {
        return textResponse("Scratch Org Snapshots isn't enabled for your Dev Hub.", true);
      } else {
        return textResponse(`Error: ${e.name} : ${e.message}`, true);
      }
    }
  }
}
