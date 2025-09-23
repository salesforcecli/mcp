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

import { join } from 'node:path';
import * as fs from 'node:fs';
import { z } from 'zod';
import { Org, scratchOrgCreate, ScratchOrgCreateOptions } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { McpTool, McpToolConfig, ReleaseState, Toolset } from '@salesforce/mcp-provider-api';
import { textResponse } from '../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../shared/params.js';

/*
 * Create a new scratch org
 *
 * Parameters:
 * - directory: directory to change to before running the command
 * - usernameOrAlias: Username or alias of the Salesforce DevHub org to use to create from
 * - duration: Duration in days of the scratch org to exist, default 7
 * - edition: Edition of the scratch org
 * - definitionFile: path to the scratch org definition file, default config/project-scratch-def.json
 * - alias: Alias to use for the scratch org
 * - async: Wait for the scratch org creation process to finish, default false
 * - setDefault: set the newly created org as default-target-org
 * - snapshot: The snapshot name to use when creating a scratch org
 * - sourceOrg: 15-character ID of the org shape that the new scratch org is based on
 * - username: Username of the scratch org admin user
 * - description: a description given to the scratch org
 * - orgName: Name of the scratch org
 * - adminEmail: Email address that will be applied to the org's admin user.
 * Returns:
 * - textResponse:
 */

const createScratchOrgParams = z.object({
  directory: directoryParam,
  devHub: usernameOrAliasParam.describe(
    'The default devhub username, use the #get_username tool to get the default devhub if unsure'
  ),
  duration: z.number().default(7).describe('number of days before the org expires'),
  edition: z
    .enum([
      'developer',
      'enterprise',
      'group',
      'professional',
      'partner-developer',
      'partner-enterprise',
      'partner-group',
      'partner-professional',
    ])
    .optional(),
  definitionFile: z
    .string()
    .default(join('config', 'project-scratch-def.json'))
    .describe('a normalized path to a scratch definition json file'),
  alias: z.string().describe('the alias to be used for the scratch org').optional(),
  async: z
    .boolean()
    .default(false)
    .describe('Whether to wait for the org creation process to finish (false) or just quickly return the ID (true)'),
  setDefault: z
    .boolean()
    .optional()
    .describe('If true, will set the newly created scratch org to be the default-target-org'),
  snapshot: z.string().describe('The snapshot name to use when creating a scratch org').optional(),
  sourceOrg: z
    .string()
    .length(15)
    .describe('15-character ID of the org shape that the new scratch org is based on')
    .optional(),
  username: z.string().describe('Username of the scratch org admin user').optional(),
  description: z.string().describe('a description given to the scratch org').optional(),
  orgName: z.string().describe('Name of the scratch org').optional(),
  adminEmail: z.string().describe("Email address that will be applied to the org's admin user.").optional(),
});

type InputArgs = z.infer<typeof createScratchOrgParams>;
type InputArgsShape = typeof createScratchOrgParams.shape;
type OutputArgsShape = z.ZodRawShape;

export class CreateScratchOrgMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.ORGS];
  }

  public getName(): string {
    return 'create_scratch_org';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Create a scratch org',
      description: `Creates a scratch org with the specified parameters.

AGENT INSTRUCTIONS:

Example usage:
Create a scratch org
create a scratch org with the definition file myDefinition.json that lasts 3 days
create a scratch org aliased as MyNewOrg and set as default and don't wait for it to finish`,
      inputSchema: createScratchOrgParams.shape,
      outputSchema: undefined,
      annotations: {},
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      process.chdir(input.directory);
      const hubOrProd = await Org.create({ aliasOrUsername: input.devHub });

      const requestParams: ScratchOrgCreateOptions = {
        hubOrg: hubOrProd,
        durationDays: input.duration,
        wait: input.async ? Duration.minutes(0) : Duration.minutes(10),
        orgConfig: {
          ...(input.definitionFile
            ? (JSON.parse(await fs.promises.readFile(input.definitionFile, 'utf-8')) as Record<string, unknown>)
            : {}),
          ...(input.edition ? { edition: input.edition } : {}),
          ...(input.snapshot ? { snapshot: input.snapshot } : {}),
          ...(input.username ? { username: input.username } : {}),
          ...(input.description ? { description: input.description } : {}),
          ...(input.orgName ? { orgName: input.orgName } : {}),
          ...(input.sourceOrg ? { sourceOrg: input.sourceOrg } : {}),
          ...(input.adminEmail ? { adminEmail: input.adminEmail } : {}),
        },
        alias: input.alias,
        setDefault: input.setDefault,
        tracksSource: true,
      };
      const result = await scratchOrgCreate(requestParams);
      if (input.async) {
        return textResponse(
          `Successfully enqueued scratch org with job Id: ${JSON.stringify(
            result.scratchOrgInfo?.Id
          )} use the #resume_tool_operation tool to resume this operation`
        );
      } else {
        return textResponse(`Successfully created scratch org  ${JSON.stringify(result)}`);
      }
    } catch (e) {
      return textResponse(`Failed to create org: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
    }
  }
}
