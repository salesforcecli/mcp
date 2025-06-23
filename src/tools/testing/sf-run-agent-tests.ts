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
import { Duration } from '@salesforce/kit';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';
import { textResponse } from '../../shared/utils.js';
import { getConnection } from '../../shared/auth.js';
import { SfMcpServer } from '../../sf-mcp-server.js';

const runAgentTestsParam = z.object({
  agentApiName: z.string().describe(
    `Agent test to run
            if unsure, list all files matching the pattern *.aiEvaluationDefinition-meta.xml
            only one test can be executed at a time
`
  ),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

export type AgentRunTests = z.infer<typeof runAgentTestsParam>;

/*
 * Run Agent tests in a Salesforce org.
 *
 * Parameters:
 * - agentApiName: this will be the aiEvaluationDefinition's name
 * - usernameOrAlias: Username or alias of the Salesforce org to run tests in.
 * - directory: Directory of the local project.
 *
 * Returns:
 * - textResponse: Test result.
 */
export const registerToolRunAgentTest = (server: SfMcpServer): void => {
  server.tool(
    'sf-run-agent-tests',
    `Run Agent tests in an org. 

AGENT INSTRUCTIONS:
If the user doesn't specify what to test, take context from the currently open file
This will ONLY run Agent tests, NOT apex tests, lightning tests, flow tests, or any other type of test.

this should be chosen when a file in the 'aiEvaluationDefinitions' directory is mentioned

EXAMPLE USAGE:
Run tests for the X agent
Run this test
`,
    runAgentTestsParam.shape,
    async ({ usernameOrAlias, agentApiName, directory }) => {
      if (!usernameOrAlias)
        return textResponse(
          'The usernameOrAlias parameter is required, if the user did not specify one use the #sf-get-username tool',
          true
        );

      // needed for org allowlist to work
      process.chdir(directory);
      const connection = await getConnection(usernameOrAlias);

      try {
        const agentTester = new AgentTester(connection);
        const test = await agentTester.start(agentApiName);
        const result = await agentTester.poll(test.runId, { timeout: Duration.minutes(10) });
        return textResponse(`Test result: ${JSON.stringify(result)}`);
      } catch (e) {
        return textResponse(`Failed to run Agent Tests: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
      }
    }
  );
};
