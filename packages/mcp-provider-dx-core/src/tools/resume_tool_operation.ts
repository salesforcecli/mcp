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
import { AgentTester } from '@salesforce/agents';
import { Connection, validateSalesforceId, scratchOrgResume, PollingClient, StatusResult } from '@salesforce/core';
import { Duration } from '@salesforce/kit';
import { MetadataApiDeploy } from '@salesforce/source-deploy-retrieve';
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { textResponse } from '../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../shared/params.js';
import { type ToolTextResponse } from '../shared/types.js';

const resumableIdPrefixes = new Map<string, string>([
  ['deploy', '0Af'],
  ['scratchOrg', '2SR'],
  ['agentTest', '4KB'],
  ['orgSnapshot', '0Oo'],
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
const resumeParamsSchema = z.object({
  jobId: z.string().describe('The job id of the long running operation to resume (required)'),
  wait: z
    .number()
    .optional()
    .default(30)
    .describe('The amount of time to wait for the operation to complete in minutes (optional)'),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

type InputArgs = z.infer<typeof resumeParamsSchema>;
type InputArgsShape = typeof resumeParamsSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class ResumeMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public constructor(private readonly services: Services) {
    super();
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.CORE];
  }

  public getName(): string {
    return 'resume_tool_operation';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Resume',
      description: `Resume a long running operation that was not completed by another tool.

AGENT INSTRUCTIONS:
Use this tool to resume a long running operation.

EXAMPLE USAGE:
Resume the metadata deploy job 0Af1234567890
Resume the deployment and wait for 10 minutes
Resume the deployment to my org
Resume scratch org creation
Resume job 2SR1234567890
Resume agent tests
Resume org snapshot with ID 0OoKa000000XZAbKAO
Report on my org snapshot`,
      inputSchema: resumeParamsSchema.shape,
      outputSchema: undefined,
      annotations: {
        openWorldHint: false,
      },
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    if (!input.jobId) {
      return textResponse('The jobId parameter is required.', true);
    }

    if (!validateSalesforceId(input.jobId)) {
      return textResponse('The jobId parameter is not a valid Salesforce id.', true);
    }

    if (!input.usernameOrAlias)
      return textResponse(
        'The usernameOrAlias parameter is required, if the user did not specify one use the #get_username tool',
        true
      );

    process.chdir(input.directory);
    const connection = await this.services.getOrgService().getConnection(input.usernameOrAlias);

    switch (input.jobId.substring(0, 3)) {
      case resumableIdPrefixes.get('deploy'):
        return resumeDeployment(connection, input.jobId, input.wait);
      case resumableIdPrefixes.get('scratchOrg'):
        return resumeScratchOrg(input.jobId, input.wait);
      case resumableIdPrefixes.get('agentTest'):
        return resumeAgentTest(connection, input.jobId, input.wait);
      case resumableIdPrefixes.get('orgSnapshot'):
        return resumeOrgSnapshot(connection, input.jobId, input.wait);
      default:
        return textResponse(`The job id: ${input.jobId} is not resumeable.`, true);
    }
  }
}

async function resumeDeployment(connection: Connection, jobId: string, wait: number): Promise<ToolTextResponse> {
  try {
    const deploy = new MetadataApiDeploy({ usernameOrConnection: connection, id: jobId });
    const result = await deploy.pollStatus({ timeout: Duration.minutes(wait) });
    return textResponse(`Deploy result: ${JSON.stringify(result.response)}`, !result.response.success);
  } catch (error) {
    return textResponse(`Resumed deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
  }
}

async function resumeOrgSnapshot(connection: Connection, jobId: string, wait: number): Promise<ToolTextResponse> {
  try {
    const poller = await PollingClient.create({
      timeout: Duration.minutes(wait),
      frequency: Duration.seconds(30),
      poll: async (): Promise<StatusResult> => {
        const queryResult = await connection.singleRecordQuery<{
          Status: 'Active' | 'Error' | 'Expired' | 'In Progress' | 'New';
        }>(
          `SELECT Status, Id, SnapshotName, Description, ExpirationDate, CreatedDate FROM OrgSnapshot WHERE Id = '${jobId}'`
        );
        if (queryResult.Status !== 'In Progress') {
          // either done or error
          return { completed: true, payload: queryResult };
        } else {
          return { completed: false };
        }
      },
    });
    const result = await poller.subscribe();
    return textResponse(`Org snapshot: ${JSON.stringify(result)}`);
  } catch (error) {
    return textResponse(
      `Resumed org snapshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      true
    );
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
