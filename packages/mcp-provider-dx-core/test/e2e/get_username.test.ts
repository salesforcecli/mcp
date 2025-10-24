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
import { ensureString } from '@salesforce/ts-types';
import { getUsernameParamsSchema } from '../../src/tools/get_username.js';

describe('get_username', () => {
  const client = new McpTestClient();

  let orgUsername: string;

  let testSession: TestSession;

  const getUsernameSchema = {
    name: z.literal('get_username'),
    params: getUsernameParamsSchema,
  };

  before(async () => {
    testSession = await TestSession.create({
      project: {
        name: 'MyTestProject',
      },
      scratchOrgs: [{ edition: 'developer', setDefault: true }],
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

  it('should resolve default org', async () => {
    const result = await client.callTool(getUsernameSchema, {
      name: 'get_username',
      params: {
        defaultTargetOrg: true,
        directory: testSession.project.dir,
      },
    });

    expect(result.content.length).to.equal(1);
    if (result.content[0].type !== 'text') assert.fail();

    const responseText = result.content[0].text;
    expect(responseText).to.contain('ALWAYS notify the user the following 3 pieces of information:');
    expect(responseText).to.contain(
      'UNLESS THE USER SPECIFIES OTHERWISE, use this username (.value) for the "usernameOrAlias" parameter in future Tool calls.',
    );

    // Extract and parse the config JSON from the response
    const configMatch = responseText.match(/Full config: ({[\s\S]*?})/);
    expect(configMatch).to.not.be.null;

    const actualConfig = JSON.parse(configMatch![1]) as {
      key: string;
      location: string;
      value: string;
      path: string;
    };
    const expectedConfig = {
      key: 'target-org',
      location: 'Local',
      value: orgUsername,
      path: path.join(testSession.project.dir, '.sf', 'config.json'),
    };
    expect(actualConfig).to.deep.equal(expectedConfig);
  });

  it('should resolve default devhub', async () => {
    const result = await client.callTool(getUsernameSchema, {
      name: 'get_username',
      params: {
        defaultTargetOrg: false,
        defaultDevHub: true,
        directory: testSession.project.dir,
      },
    });

    expect(result.content.length).to.equal(1);
    if (result.content[0].type !== 'text') assert.fail();

    const responseText = result.content[0].text;
    expect(responseText).to.contain('ALWAYS notify the user the following 3 pieces of information:');
    expect(responseText).to.contain(
      'UNLESS THE USER SPECIFIES OTHERWISE, use this username (.value) for the "usernameOrAlias" parameter in future Tool calls.',
    );

    // Extract and parse the config JSON from the response
    const configMatch = responseText.match(/Full config: ({[\s\S]*?})/);
    expect(configMatch).to.not.be.null;

    const actualConfig = JSON.parse(configMatch![1]) as {
      key: string;
      location: string;
      value: string;
      path: string;
    };
    const expectedConfig = {
      key: 'target-dev-hub',
      location: 'Local',
      value: testSession.hubOrg.username,
      path: path.join(testSession.project.dir, '.sf', 'config.json'),
    };
    expect(actualConfig).to.deep.equal(expectedConfig);
  });
});
