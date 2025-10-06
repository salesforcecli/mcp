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

import { assert, expect } from 'chai';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { matchesAccessToken } from '@salesforce/core';
import { ensureString } from '@salesforce/ts-types';
import { createScratchOrgParams } from '../../src/tools/create_scratch_org.js';
import { resumeParamsSchema } from '../../src/tools/resume_tool_operation.js';

describe('create_scratch_org', () => {
  const client = new McpTestClient({
    timeout: 120_000,
  });
  
  let devHubUsername: string;

  let testSession: TestSession;

  const createScratchOrgSchema = {
    name: z.literal('create_scratch_org'),
    params: createScratchOrgParams,
  };

  before(async () => {
    testSession = await TestSession.create({
      project: {
        name: 'MyTestProject',
      },
      devhubAuthStrategy: 'AUTO',
    });

    devHubUsername = ensureString(testSession.hubOrg?.username);

    const transport = DxMcpTransport({
      args: ['--orgs', `DEFAULT_TARGET_ORG,${devHubUsername}`, '--no-telemetry', '--toolsets', 'all', '--allow-non-ga-tools'],
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

  it('should create a scratch org', async () => {
    const result = await client.callTool(createScratchOrgSchema, {
      name: 'create_scratch_org',
      params: {
        directory: testSession.project.dir,
        devHub: devHubUsername,
      },
    });
    
    expect(result.isError).to.be.false;
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');
    
    const responseText = result.content[0].text as string;
    assertNoSensitiveInfo(responseText)
    expect(responseText).to.include('Successfully created scratch org');
  });

  it('should create scratch org asynchronously', async () => {
    const asyncResult = await client.callTool(createScratchOrgSchema, {
      name: 'create_scratch_org',
      params: {
        directory: testSession.project.dir,
        devHub: devHubUsername,
        async: true,
        alias: 'test-async-org'
      },
    });
    expect(asyncResult.isError).to.be.false;
    expect(asyncResult.content.length).to.equal(1);
    
    if (asyncResult.content[0].type !== 'text') assert.fail();

    const asyncResponseText = asyncResult.content[0].text;
    expect(asyncResponseText).to.include('Successfully enqueued scratch org with job Id:');

    // now validate it was created by resuming the operation

    const jobIdMatch = asyncResponseText.match(/job Id: ([A-Za-z0-9]+)/);
    expect(jobIdMatch).to.not.be.null;
    
    const jobId: string =  jobIdMatch![1]

    const asyncResumeResult = await client.callTool({
      name: z.literal('resume_tool_operation'),
      params: resumeParamsSchema
    }, {
      name: 'resume_tool_operation',
      params: {
        directory: testSession.project.dir,
        jobId,
        usernameOrAlias: ensureString(testSession.hubOrg.username)
      },
    });

    expect(asyncResumeResult.isError).to.be.false;
    expect(asyncResumeResult.content.length).to.equal(1);
    
    if (asyncResumeResult.content[0].type !== 'text') assert.fail();

    const asyncResumeResponseText = asyncResumeResult.content[0].text;
    
    // tool output shouldn't access tokens/auth info other than the username
    assertNoSensitiveInfo(asyncResumeResponseText);
    expect(asyncResumeResponseText).to.include('Successfully created scratch org');
  });

  it('should create scratch org with optional parameters', async () => {
    const result = await client.callTool(createScratchOrgSchema, {
      name: 'create_scratch_org',
      params: {
        directory: testSession.project.dir,
        devHub: devHubUsername,
        alias: 'test-custom-org',
        duration: 3,
        edition: 'developer',
        description: 'Test scratch org with custom parameters',
        orgName: 'Test Org Name'
      },
    });

    expect(result.isError).to.be.false;
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');
    
    const responseText = result.content[0].text;
    expect(responseText).to.include('Successfully created scratch org');
  });

  it('should handle invalid devHub username', async () => {
    const result = await client.callTool(createScratchOrgSchema, {
      name: 'create_scratch_org',
      params: {
        directory: testSession.project.dir,
        devHub: 'invalid-devhub-username@example.com',
        alias: 'test-invalid-devhub'
      },
    });

    expect(result.isError).to.be.true;
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');
    
    const responseText = result.content[0].text;
    expect(responseText).to.include('Failed to create org:');
  });
});

/**
 * Helper function to assert that response text doesn't contain sensitive authentication information
 */
function assertNoSensitiveInfo(responseText: string): void {
  expect(matchesAccessToken(responseText)).to.be.false;
  expect(responseText).to.not.match(/authcode/i);
  expect(responseText).to.not.match(/token/i);
  expect(responseText).to.not.match(/privatekey/i);
  expect(responseText).to.not.match(/clientid/i);
  expect(responseText).to.not.match(/connectedappconsumerkey/i);
}
