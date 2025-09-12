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
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { ensureString } from '@salesforce/ts-types';
import { deployMetadataParams } from '../../src/tools/sf-deploy-metadata.js';

describe('sf-deploy-metadata', () => {
  const client = new McpTestClient({
    timeout: 600_000, // 10 minutes for deploy operations
  });

  let testSession: TestSession;
  let orgUsername: string;

  const deployMetadataSchema = {
    name: z.literal('sf-deploy-metadata'),
    params: deployMetadataParams,
  };

  before(async () => {
    try {
      testSession = await TestSession.create({
        project: { gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc' },
        scratchOrgs: [{ setDefault: true, config: path.join('config', 'project-scratch-def.json') }],
        devhubAuthStrategy: 'AUTO',
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

  it('should deploy the whole project', async () => {
    const result = await client.callTool(deployMetadataSchema, {
      name: 'sf-deploy-metadata',
      params: {
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Deploy result:');

    // Parse the deploy result JSON
    // @ts-ignore
    const deployMatch = responseText.match(/Deploy result: ({.*})/);
    expect(deployMatch).to.not.be.null;

    const deployResult = JSON.parse(deployMatch![1]);
    expect(deployResult.success).to.be.true;
    expect(deployResult.done).to.be.true;
    expect(deployResult.numberComponentsDeployed).to.equal(93);
  });

  it('should deploy just 1 apex class and run a specific tests', async () => {
    // Find an Apex class to deploy (PropertyController is in dreamhouse)
    const apexClassPath = path.join(
      testSession.project.dir,
      'force-app',
      'main',
      'default',
      'classes',
      'GeocodingService.cls'
    );

    const result = await client.callTool(deployMetadataSchema, {
      name: 'sf-deploy-metadata',
      params: {
        sourceDir: [apexClassPath],
        apexTests: ['GeocodingServiceTest'],
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.be.false;
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Deploy result:');

    // Parse the deploy result JSON
    // @ts-ignore
    const deployMatch = responseText.match(/Deploy result: ({.*})/);
    expect(deployMatch).to.not.be.null;

    const deployResult = JSON.parse(deployMatch![1]);
    expect(deployResult.success).to.be.true;
    expect(deployResult.done).to.be.true;
    expect(deployResult.numberComponentsDeployed).to.equal(1);
    expect(deployResult.runTestsEnabled).to.be.true;
    expect(deployResult.numberTestsCompleted).to.equal(3);

    // Assert that the 3 GeocodingServiceTest methods were run
    const testSuccesses = deployResult.details.runTestResult.successes;
    const expectedMethods = ['blankAddress', 'successResponse', 'errorResponse'];

    expectedMethods.forEach((method) => {
      const testRun = testSuccesses.find(
        (success: { name: string; methodName: string }) =>
          success.methodName === method && success.name === 'GeocodingServiceTest'
      );
      expect(testRun).to.not.be.undefined;
    });
  });

  it('should fail if both apexTests and apexTestLevel params are set', async () => {
    // Find an Apex class to deploy (PropertyController is in dreamhouse)
    const apexClassPath = path.join(
      testSession.project.dir,
      'force-app',
      'main',
      'default',
      'classes',
      'GeocodingService.cls'
    );

    const result = await client.callTool(deployMetadataSchema, {
      name: 'sf-deploy-metadata',
      params: {
        sourceDir: [apexClassPath],
        apexTestLevel: 'RunAllTestsInOrg',
        apexTests: ['GeocodingServiceTest'],
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.be.true;
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.contain("You can't specify both `apexTests` and `apexTestLevel` parameters.");
  });

  it('should deploy just 1 apex class and run all tests in org', async () => {
    // Find an Apex class to deploy (PropertyController is in dreamhouse)
    const apexClassPath = path.join(
      testSession.project.dir,
      'force-app',
      'main',
      'default',
      'classes',
      'PropertyController.cls'
    );

    const result = await client.callTool(deployMetadataSchema, {
      name: 'sf-deploy-metadata',
      params: {
        sourceDir: [apexClassPath],
        apexTestLevel: 'RunAllTestsInOrg',
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Deploy result:');

    // Parse the deploy result JSON
    // @ts-ignore
    const deployMatch = responseText.match(/Deploy result: ({.*})/);
    expect(deployMatch).to.not.be.null;

    const deployResult = JSON.parse(deployMatch![1]);
    expect(deployResult.success).to.be.true;
    expect(deployResult.done).to.be.true;
    expect(deployResult.numberComponentsDeployed).to.equal(1);
    expect(deployResult.numberTestsCompleted).to.equal(11);
    expect(deployResult.runTestsEnabled).to.be.true;
  });
});
