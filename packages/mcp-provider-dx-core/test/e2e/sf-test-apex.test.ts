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

import path from 'node:path';
import { expect } from 'chai';
import { TestLevel } from '@salesforce/apex-node';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { ensureString } from '@salesforce/ts-types';
import { runApexTestsParam } from '../../src/tools/sf-test-apex.js';

describe('sf-test-apex', () => {
  const client = new McpTestClient();

  let testSession: TestSession;
  let orgUsername: string;

  const testApexSchema = {
    name: z.literal('sf-test-apex'),
    params: runApexTestsParam,
  };

  before(async () => {
    try {
      testSession = await TestSession.create({
        project: { gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc' },
        scratchOrgs: [{ setDefault: true, config: path.join('config', 'project-scratch-def.json') }],
        devhubAuthStrategy: 'AUTO',
      });

      // Deploy the project first so we have tests to run
      execCmd('project deploy start', {
        cli: 'sf',
        ensureExitCode: 0,
      });

      orgUsername = [...testSession.orgs.keys()][0];

      const transport = DxMcpTransport({
        orgUsername: ensureString(orgUsername),
      });

      await client.connect(transport);
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  });

  after(async () => {
    if (client?.connected) {
      await client.disconnect();
    }
    if (testSession) {
      await testSession.clean();
    }
  });

  it('should run all tests in org', async () => {
    const result = await client.callTool(testApexSchema, {
      name: 'sf-test-apex',
      params: {
        testLevel: TestLevel.RunAllTestsInOrg,
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Test result:');

    // Parse the test result JSON
    // @ts-ignore
    const testMatch = responseText.match(/Test result: ({.*})/);
    expect(testMatch).to.not.be.null;

    const testResult = JSON.parse(testMatch![1]);
    expect(testResult.summary).to.not.be.undefined;
    expect(testResult.summary.outcome).to.equal('Passed');

    expect(testResult.summary.testsRan).to.be.greaterThan(10);
    expect(testResult.summary.skipped).to.equal(0);
  });

  it('should run a specific test class', async () => {
    const result = await client.callTool(testApexSchema, {
      name: 'sf-test-apex',
      params: {
        testLevel: TestLevel.RunSpecifiedTests,
        classNames: ['GeocodingServiceTest'],
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
        verbose: true,
      },
    });

    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Test result:');

    // Parse the test result JSON
    // @ts-ignore
    const testMatch = responseText.match(/Test result: ({.*})/);
    expect(testMatch).to.not.be.null;

    const testResult = JSON.parse(testMatch![1]);
    expect(testResult.summary).to.not.be.undefined;
    expect(testResult.summary.outcome).to.equal('Passed');

    // Should have run exactly 3 test methods from GeocodingServiceTest
    expect(testResult.tests.length).to.equal(3);

    // Verify all tests are from GeocodingServiceTest
    testResult.tests.forEach((test: { fullName: string }) => {
      expect(test.fullName).to.contain('GeocodingServiceTest');
    });
  });

  it('should fail if suiteName, methodNames and/or classNames params are set without testLevel!=RunSpecifiedTests', async () => {
    const result = await client.callTool(testApexSchema, {
      name: 'sf-test-apex',
      params: {
        testLevel: TestLevel.RunAllTestsInOrg,
        classNames: ['GeocodingServiceTest'],
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.equal(true);
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.contain(
      "You can't specify which tests to run without setting testLevel='RunSpecifiedTests'"
    );
  });
});
