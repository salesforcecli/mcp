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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Org, scratchOrgCreate, ScratchOrgCreateOptions } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { textResponse } from '../../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';

/*
 * Create a new scratch org
 *
 * Parameters:
 * - directory: directory to change to before running the command
 * - usernameOrAlias: Username or alias of the Salesforce DevHub/prod org to use to create from
 *
 * Returns:
 * - textResponse:
 */

export const createScratchOrgParams = z.object({
  directory: directoryParam,
  usernameOrAlias: usernameOrAliasParam,
  // release: z
  //   .enum(['previous', 'preview'])
  //   .describe('the release version of the scratch org you want created').optional(),
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
  name: z.string().describe('Name of the scratch org').optional(),
  adminEmail: z.string().describe("Email address that will be applied to the org's admin user.").optional(),
});

export type CreateScratchOrgOptions = z.infer<typeof createScratchOrgParams>;

export const registerToolCreateScratchOrg = (server: McpServer): void => {
  server.tool(
    'sf-create-scratch-org',
    `Creates a scratch org with the specified parameters.

AGENT INSTRUCTIONS:

Example usage:
Create a scratch org
create a scratch org with the definition file myDefinition.json that lasts 3 days
create a scratch org aliased as MyNewOrg and set as default
`,
    createScratchOrgParams.shape,
    async ({
      directory,
      usernameOrAlias,
      name,
      adminEmail,
      description,
      // release,
      snapshot,
      sourceOrg,
      username,
      edition,
      setDefault,
      duration,
      alias,
      definitionFile,
    }) => {
      try {
        process.chdir(directory);
        const hubOrProd = await Org.create({ aliasOrUsername: usernameOrAlias });

        const requestParams: ScratchOrgCreateOptions = {
          hubOrg: hubOrProd,
          // clientSecret,
          // connectedAppConsumerKey: flags['client-id'],
          durationDays: duration,
          // nonamespace: flags['no-namespace'],
          // noancestors: flags['no-ancestors'],
          wait: Duration.minutes(5),
          apiversion: await hubOrProd.retrieveMaxApiVersion(),
          orgConfig: {
            ...(definitionFile
              ? (JSON.parse(await fs.promises.readFile(definitionFile, 'utf-8')) as Record<string, unknown>)
              : {}),
            ...(edition ? { edition } : {}),
            ...(snapshot ? { snapshot } : {}),
            ...(username ? { username } : {}),
            ...(description ? { description } : {}),
            ...(name ? { orgName: name } : {}),
            // ...(release ? { release } : {}),
            ...(sourceOrg ? { sourceOrg } : {}),
            ...(adminEmail ? { adminEmail } : {}),
          },
          alias,
          setDefault,
          tracksSource: true,
        };
        const result = await scratchOrgCreate(requestParams);

        return textResponse(`Successfully created scratch org  ${JSON.stringify(result)}`);
      } catch (e) {
        return textResponse(`Failed to create org: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
      }
    }
  );
};
