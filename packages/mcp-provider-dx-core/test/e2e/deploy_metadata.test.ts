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
import { expect, assert } from 'chai';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { AuthInfo, Connection } from '@salesforce/core';
import { ensureString } from '@salesforce/ts-types';
import { deployMetadataParams } from '../../src/tools/deploy_metadata.js';

describe('deploy_metadata', () => {
  const client = new McpTestClient({
    timeout: 120_000,
  });

  let testSession: TestSession;
  let orgUsername: string;

  const deployMetadataSchema = {
    name: z.literal('deploy_metadata'),
    params: deployMetadataParams,
  };

  before(async () => {
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
      name: 'deploy_metadata',
      params: {
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    if (result.content[0].type !== 'text') assert.fail();

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Deploy result:');

    // Parse the deploy result JSON
    const deployMatch = responseText.match(/Deploy result: ({.*})/);
    expect(deployMatch).to.not.be.null;

    const deployResult = JSON.parse(deployMatch![1]) as {
      success: boolean;
      done: boolean;
      numberComponentsDeployed: number;
    };
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
      'GeocodingService.cls',
    );

    const result = await client.callTool(deployMetadataSchema, {
      name: 'deploy_metadata',
      params: {
        sourceDir: [apexClassPath],
        apexTests: ['GeocodingServiceTest'],
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.be.false;
    expect(result.content.length).to.equal(1);
    if (result.content[0].type !== 'text') assert.fail();

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Deploy result:');

    // Parse the deploy result JSON
    const deployMatch = responseText.match(/Deploy result: ({.*})/);
    expect(deployMatch).to.not.be.null;

    const deployResult = JSON.parse(deployMatch![1]) as {
      success: boolean;
      done: boolean;
      numberComponentsDeployed: number;
      runTestsEnabled: boolean;
      numberTestsCompleted: number;
      details: {
        runTestResult: {
          successes: Array<{ name: string; methodName: string }>;
        };
      };
    };
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
          success.methodName === method && success.name === 'GeocodingServiceTest',
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
      'GeocodingService.cls',
    );

    const result = await client.callTool(deployMetadataSchema, {
      name: 'deploy_metadata',
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
    if (result.content[0].type !== 'text') assert.fail();

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
      'PropertyController.cls',
    );

    const result = await client.callTool(deployMetadataSchema, {
      name: 'deploy_metadata',
      params: {
        sourceDir: [apexClassPath],
        apexTestLevel: 'RunAllTestsInOrg',
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.content.length).to.equal(1);
    if (result.content[0].type !== 'text') assert.fail();

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Deploy result:');

    // Parse the deploy result JSON
    const deployMatch = responseText.match(/Deploy result: ({.*})/);
    expect(deployMatch).to.not.be.null;

    const deployResult = JSON.parse(deployMatch![1]) as {
      success: boolean;
      done: boolean;
      numberComponentsDeployed: number;
      numberTestsCompleted: number;
      runTestsEnabled: boolean;
    };
    expect(deployResult.success).to.be.true;
    expect(deployResult.done).to.be.true;
    expect(deployResult.numberComponentsDeployed).to.equal(1);
    expect(deployResult.numberTestsCompleted).to.equal(11);
    expect(deployResult.runTestsEnabled).to.be.true;
  });

  it('should deploy remote edit when ignoreConflicts is set to true', async () => {
    const customAppPath = path.join(
      testSession.project.dir,
      'force-app',
      'main',
      'default',
      'applications',
      'Dreamhouse.app-meta.xml',
    );

    // deploy the whole project to ensure the file exists
    const fullProjectDeploy = await client.callTool(deployMetadataSchema, {
      name: 'deploy_metadata',
      params: {
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(fullProjectDeploy.isError).to.be.false;
    expect(fullProjectDeploy.content.length).to.equal(1);

    // Make a remote edit using Tooling API
    const conn = await Connection.create({
      authInfo: await AuthInfo.create({ username: orgUsername }),
    });

    const customApp = await conn.singleRecordQuery<{ 
      Id: string; 
      Metadata: {
        description: string | null;
      };
    }>(
      "SELECT Id, Metadata FROM CustomApplication WHERE DeveloperName = 'Dreamhouse'",
      {
        tooling: true,
      }
    );

    const updatedMetadata = {
      ...customApp.Metadata,
      description: customApp.Metadata.description 
        ? `${customApp.Metadata.description} - Remote edit via Tooling API`
        : 'Remote edit via Tooling API',
    };

    await conn.tooling.sobject('CustomApplication').update({
      Id: customApp.Id,
      Metadata: updatedMetadata,
    });

    // Deploy with ignoreConflicts=true - should override remote edit
    const deployResult = await client.callTool(deployMetadataSchema, {
      name: 'deploy_metadata',
      params: {
        sourceDir: [customAppPath],
        ignoreConflicts: true,
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(deployResult.isError).to.equal(false);
    expect(deployResult.content.length).to.equal(1);
    if (deployResult.content[0].type !== 'text') assert.fail();

    const deployText = deployResult.content[0].text;
    expect(deployText).to.contain('Deploy result:');

    const deployMatch = deployText.match(/Deploy result: ({.*})/);
    expect(deployMatch).to.not.be.null;

    const result = JSON.parse(deployMatch![1]) as {
      success: boolean;
      done: boolean;
      numberComponentsDeployed: number;
    };

    expect(result.success).to.be.true;
    expect(result.done).to.be.true;
    expect(result.numberComponentsDeployed).to.equal(1);
  });
});
