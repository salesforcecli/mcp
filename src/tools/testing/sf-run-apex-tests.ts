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
import { TestLevel, TestResult, TestService } from '@salesforce/apex-node';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';
import { textResponse } from '../../shared/utils.js';
import { getConnection } from '../../shared/auth.js';
import { SfMcpServer } from '../../sf-mcp-server.js';

const runApexTestsParam = z.object({
  testLevel: z.enum([TestLevel.RunLocalTests, TestLevel.RunAllTestsInOrg, TestLevel.RunSpecifiedTests]).describe(
    `Apex test level

AGENT INSTRUCTIONS
Choose the correct value based on what tests are meant to be executed in some of these ways:

RunLocalTests="Run all tests in the org, except the ones that originate from installed managed and unlocked packages."
RunAllTestsInOrg="Run all tests in the org, including tests of managed packages"
RunSpecifiedTests="Run the Apex tests I specify, these will be specified in the classNames parameter"
`
  ),
  classNames: z.array(z.string()).describe(
    `Apex tests classes to run.
            if Running all tests, all tests should be listed
            if unsure, find apex classes matching the pattern *.cls, that include the @isTest decorator in the file and then join their test names together with ','
`
  ),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

export type ApexRunTests = z.infer<typeof runApexTestsParam>;

/*
 * Run Apex tests in a Salesforce org.
 *
 * Parameters:
 * - testLevel: 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg', used to specify the specific test-level.
 * - classNames: if testLevel='RunSpecifiedTests', this will be the specified tests to run
 * - usernameOrAlias: Username or alias of the Salesforce org to run tests in.
 * - directory: Directory of the local project.
 *
 * Returns:
 * - textResponse: Test result.
 */
export const registerToolRunApexTest = (server: SfMcpServer): void => {
  server.tool(
    'sf-run-apex-tests',
    `Run Apex tests in an org.

AGENT INSTRUCTIONS:
If the user doesn't specify what to test, take context from the currently open file
This will ONLY run APEX tests, NOT agent tests, lightning tests, flow tests, or any other type of test.

this should be chosen when a file in the 'classes' directory is mentioned

EXAMPLE USAGE:
Run tests A, B, C.
Run the tests, find apex classes matching the pattern *.cls, that include the @isTest decorator in the file and then join their test names together with ','
Run all tests in the org.
`,
    runApexTestsParam.shape,
    {
      title: 'Run Apex Tests',
      openWorldHint: false,
    },
    async ({ testLevel, usernameOrAlias, classNames, directory }) => {
      if (testLevel !== TestLevel.RunSpecifiedTests && classNames?.length && classNames?.length >= 1) {
        return textResponse("You can't specify which tests to run without setting testLevel='RunSpecifiedTests'", true);
      }

      if (!usernameOrAlias)
        return textResponse(
          'The usernameOrAlias parameter is required, if the user did not specify one use the #sf-get-username tool',
          true
        );

      // needed for org allowlist to work
      process.chdir(directory);

      const connection = await getConnection(usernameOrAlias);
      try {
        const testService = new TestService(connection);

        const payload = await testService.buildAsyncPayload(testLevel, classNames.join(','));
        const result = (await testService.runTestAsynchronous(payload, false)) as TestResult;
        return textResponse(`Test result: ${JSON.stringify(result)}`);
      } catch (e) {
        return textResponse(`Failed to run Apex Tests: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
      }
    }
  );
};
