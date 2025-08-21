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
import { TestLevel, TestResult, TestRunIdResult, TestService } from '@salesforce/apex-node';
import { ApexTestResultOutcome } from '@salesforce/apex-node/lib/src/tests/types.js';
import { Duration, ensureArray } from '@salesforce/kit';
import { McpTool, McpToolConfig, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';
import { textResponse } from '../../shared/utils.js';
import { getConnection } from '../../shared/auth.js';

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
  classNames: z
    .array(z.string())
    .describe(
      `Apex tests classes to run.
            if Running all tests, all tests should be listed
            Run the tests, find apex classes matching the pattern **/classes/*.cls, that include the @isTest decorator in the file and then join their test names together with ','
`
    )
    .optional(),
  methodNames: z
    .array(z.string())
    .describe(
      'Specific test method names, functions inside of an apex test class, must be joined with the Apex tests name'
    )
    .optional(),
  async: z
    .boolean()
    .default(false)
    .describe(
      'Weather to wait for the test to finish (false) or enque the Apex tests and return the test run id (true)'
    ),
  suiteName: z.string().describe('a suite of apex test classes to run').optional(),
  testRunId: z.string().default('an id of an in-progress, or completed apex test run').optional(),
  verbose: z
    .boolean()
    .default(false)
    .describe('If a user wants more test information in the context, or information about passing tests'),
  codeCoverage: z
    .boolean()
    .default(false)
    .describe('set to true if a user wants codecoverage calculated by the server'),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

type InputArgs = z.infer<typeof runApexTestsParam>;
type InputArgsShape = typeof runApexTestsParam.shape;
type OutputArgsShape = z.ZodRawShape;

export class TestApexMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public getToolsets(): Toolset[] {
    return [Toolset.TESTING];
  }

  public getName(): string {
    return 'sf-test-apex';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Apex Tests',
      description: `Run Apex tests in an org.

AGENT INSTRUCTIONS:
If the user doesn't specify what to test, take context from the currently open file
This will ONLY run APEX tests, NOT agent tests, lightning tests, flow tests, or any other type of test.

this should be chosen when a file in the 'classes' directory is mentioned

EXAMPLE USAGE:
Run tests A, B, C.
Run the myTestMethod in this file
Run this test and include success and failures
Run all tests in the org.
Test the "mySuite" suite asynchronously. I’ll check results later.
Run tests for this file and include coverage
What are the results for 707XXXXXXXXXXXX`,
      inputSchema: runApexTestsParam.shape,
      outputSchema: undefined,
      annotations: {
        openWorldHint: false
      }
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    if (
      (ensureArray(input.suiteName).length > 1 ||
        ensureArray(input.methodNames).length > 1 ||
        ensureArray(input.classNames).length > 1) &&
      input.testLevel !== TestLevel.RunSpecifiedTests
    ) {
      return textResponse("You can't specify which tests to run without setting testLevel='RunSpecifiedTests'", true);
    }

    if (!input.usernameOrAlias)
      return textResponse(
        'The usernameOrAlias parameter is required, if the user did not specify one use the #sf-get-username tool',
        true
      );

    // needed for org allowlist to work
    process.chdir(input.directory);

    const connection = await getConnection(input.usernameOrAlias);
    try {
      const testService = new TestService(connection);
      let result: TestResult | TestRunIdResult;

      if (input.testRunId) {
        // we just need to get the test results
        result = await testService.reportAsyncResults(input.testRunId, input.codeCoverage);
      } else {
        // we need to run tests
        const payload = await testService.buildAsyncPayload(
          input.testLevel,
          input.methodNames?.join(','),
          input.classNames?.join(','),
          input.suiteName
        );
        result = await testService.runTestAsynchronous(
          payload,
          input.codeCoverage,
          input.async,
          undefined,
          undefined,
          Duration.minutes(10)
        );
        if (input.async) {
          return textResponse(`Test Run Id: ${JSON.stringify(result)}`);
        }
        // the user waited for the full results, we know they're TestResult
        result = result as TestResult;
      }

      if (!input.verbose) {
        // aka concise, filter out passing tests
        result.tests = result.tests.filter((test) => test.outcome === ApexTestResultOutcome.Fail);
      }

      return textResponse(`Test result: ${JSON.stringify(result)}`);
    } catch (e) {
      return textResponse(`Failed to run Apex Tests: ${e instanceof Error ? e.message : 'Unknown error'}`, true);
    }
  }
}