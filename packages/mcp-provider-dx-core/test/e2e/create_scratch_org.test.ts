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

import { expect } from 'chai';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { createScratchOrgParams } from '../../src/tools/create_scratch_org.js';

describe('create_scratch_org', () => {
  const client = new McpTestClient({
    timeout: 120_000,
  });
  
  const devHubUsername = process.env.TESTKIT_HUB_USERNAME as string;

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

    const transport = DxMcpTransport({
      args: ['--orgs', 'ALLOW_ALL_ORGS', '--no-telemetry', '--toolsets', 'all', '--allow-non-ga-tools'],
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
    
    const responseText = result.content[0].text;
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
    expect(asyncResult.content[0].type).to.equal('text');
    
    const asyncResponseText = asyncResult.content[0].text;
    expect(asyncResponseText).to.include('Successfully enqueued scratch org with job Id:');
    expect(asyncResponseText).to.include('use the #resume_tool_operation tool');
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