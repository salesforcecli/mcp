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

import { ExecuteService } from '@salesforce/apex-node';
import { getConnection } from '../../shared/auth.js';
import { textResponse } from '../../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';
import { SfMcpServer } from '../../sf-mcp-server.js';

export const apexRunParamsSchema = z.object({
  apexCode: z.string().describe('Anonymous apex code to execute'),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

export type ApexRunOptions = z.infer<typeof apexRunParamsSchema>;

export const registerToolApexRun = (server: SfMcpServer): void => {
  server.tool(
    'sf-apex-run',
    'Run anonymous apex code against a Salesforce org.',
    apexRunParamsSchema.shape,
    {
      title: 'Apex Run',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    async ({ apexCode, usernameOrAlias, directory }) => {
      try {
        if (!usernameOrAlias)
          return textResponse(
            'The usernameOrAlias parameter is required, if the user did not specify one use the #sf-get-username tool',
            true
          );
        process.chdir(directory);

        const connection = await getConnection(usernameOrAlias);
        const executeService = new ExecuteService(connection);
        const result = await executeService.executeAnonymous({
          apexCode,
        });

        return textResponse('Apex Run Result: ' + JSON.stringify(result));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return textResponse(`Failed to query org: ${errorMessage}`, true);
      }
    }
  );
};
