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
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { ensureString } from '@salesforce/ts-types';
import { assignPermissionSetParamsSchema } from '../../src/tools/sf-assign-permission-set.js';

describe('sf-assign-permission-set', () => {
  const client = new McpTestClient({});

  let testSession: TestSession;
  let orgUsername: string;

  const assignPermissionSetSchema = {
    name: z.literal('sf-assign-permission-set'),
    params: assignPermissionSetParamsSchema,
  };

  before(async () => {
    try {
      testSession = await TestSession.create({
        project: { gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc' },
        scratchOrgs: [{ setDefault: true, config: path.join('config', 'project-scratch-def.json') }],
        devhubAuthStrategy: 'AUTO',
      });

      // Deploy the project first so we have the dreamhouse permission set
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

  it('should assign a permset', async () => {
    const result = await client.callTool(assignPermissionSetSchema, {
      name: 'sf-assign-permission-set',
      params: {
        permissionSetName: 'dreamhouse',
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.equal(false);
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.equal(`Assigned dreamhouse to ${orgUsername}`);
  });

  it('should fail if unable to set permset', async () => {
    const result = await client.callTool(assignPermissionSetSchema, {
      name: 'sf-assign-permission-set',
      params: {
        permissionSetName: 'nonexistent_permission_set',
        usernameOrAlias: orgUsername,
        directory: testSession.project.dir,
      },
    });

    expect(result.isError).to.be.true;
    expect(result.content.length).to.equal(1);
    expect(result.content[0].type).to.equal('text');

    const responseText = result.content[0].text;
    expect(responseText).to.contain('Failed to assign permission set:');
  });
});
