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
import { AgentTester } from '@salesforce/agents';
import { Connection, validateSalesforceId, scratchOrgResume } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { MetadataApiDeploy } from '@salesforce/source-deploy-retrieve';
import { textResponse } from '../../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';
import { getConnection } from '../../shared/auth.js';
import { type ToolTextResponse } from '../../shared/types.js';

const resumableIdPrefixes = new Map<string, string>([
  ['deploy', '0Af'],
  ['scratchOrg', '2SR'],
  ['agentTest', '4KB'],
]);

/*
 * Resume a long running operation that was not completed by another tool.
 *
 * Intelligently determines the appropriate username or alias for Salesforce operations.
 *
 * Parameters:
 * - jobId: The job id of the long running operation to resume (required)
 * - wait: The amount of time to wait for the operation to complete in minutes (optional)
 * - defaultTargetOrg: Force lookup of default target org (optional)
 * - directory: The directory to run this tool from
 *
 * Returns:
 * - textResponse: Username/alias and org configuration
 */
export const resumeParamsSchema = z.object({
  jobId: z.string().describe('The job id of the long running operation to resume (required)'),
  wait: z
    .number()
    .optional()
    .default(30)
    .describe('The amount of time to wait for the operation to complete in minutes (optional)'),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

export type ResumeParamsSchema = z.infer<typeof resumeParamsSchema>;

export const registerToolResume = (server: McpServer): void => {
  server.tool(
    'sf-resume',
    `Resume a long running operation that was not completed by another tool.

AGENT INSTRUCTIONS:
Use this tool to resume a long running operation.

EXAMPLE USAGE:
Resume the metadata deploy job 0Af1234567890
Resume the deployment and wait for 10 minutes
Resume the deployment to my org
Resume scratch org creation
Resume job 2SR1234567890
Resume agent tests
`,
    resumeParamsSchema.shape,
    {
      title: 'Resume',
      openWorldHint: false,
    },
    async ({ jobId, wait, usernameOrAlias, directory }) => {
      if (!jobId) {
        return textResponse('The jobId parameter is required.', true);
      }

      if (!validateSalesforceId(jobId)) {
        return textResponse('The jobId parameter is not a valid Salesforce id.', true);
      }

      if (!usernameOrAlias)
        return textResponse(
          'The usernameOrAlias parameter is required, if the user did not specify one use the #sf-get-username tool',
          true
        );

      process.chdir(directory);
      const connection = await getConnection(usernameOrAlias);

      switch (jobId.substring(0, 3)) {
        case resumableIdPrefixes.get('deploy'):
          return resumeDeployment(connection, jobId, wait);
        case resumableIdPrefixes.get('scratchOrg'):
          return resumeScratchOrg(jobId, wait);
        case resumableIdPrefixes.get('agentTest'):
          return resumeAgentTest(connection, jobId, wait);
        default:
          return textResponse(`The job id: ${jobId} is not resumeable.`, true);
      }
    }
  );
};

async function resumeDeployment(connection: Connection, jobId: string, wait: number): Promise<ToolTextResponse> {
  try {
    const deploy = new MetadataApiDeploy({ usernameOrConnection: connection, id: jobId });
    const result = await deploy.pollStatus({ timeout: Duration.minutes(wait) });
    return textResponse(`Deploy result: ${JSON.stringify(result.response)}`, !result.response.success);
  } catch (error) {
    return textResponse(`Resumed deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
  }
}

async function resumeScratchOrg(jobId: string, wait: number): Promise<ToolTextResponse> {
  try {
    const result = await scratchOrgResume(jobId, Duration.minutes(wait));
    return textResponse(`Scratch org created: ${JSON.stringify(result)}`, false);
  } catch (error) {
    return textResponse(
      `Resumed scratch org creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      true
    );
  }
}

async function resumeAgentTest(connection: Connection, jobId: string, wait: number): Promise<ToolTextResponse> {
  try {
    const agentTester = new AgentTester(connection);
    const result = await agentTester.poll(jobId, { timeout: Duration.minutes(wait) });
    return textResponse(`Agent test result: ${JSON.stringify(result)}`, !!result.errorMessage);
  } catch (error) {
    return textResponse(`Resumed agent test failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
  }
}
