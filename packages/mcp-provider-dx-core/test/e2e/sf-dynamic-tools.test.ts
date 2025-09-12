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
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { DxMcpTransport } from '@salesforce/mcp-test-client';

describe('sf-dynamic-tools', () => {
  const client = new Client({
    name: 'sf-dynamic-tools',
    version: '0.0.1',
  });

  before(async () => {
    const transport = DxMcpTransport({
      args: ['--orgs', 'ALLOW_ALL_ORGS', '--dynamic-tools', '--no-telemetry'],
    });

    await client.connect(transport);
  });

  after(async () => {
    await client.close();
  });

  it('should enable 2 tools', async () => {
    const initialTools = (await client.listTools()).tools.map((t) => t.name).sort();

    expect(initialTools.length).to.equal(4);
    expect(initialTools).to.deep.equal(['sf-enable-tools', 'sf-get-username', 'sf-list-tools', 'sf-resume'].sort());

    const result = await client.callTool({
      name: 'sf-enable-tools',
      arguments: {
        tools: ['sf-query-org', 'sf-deploy-metadata'],
      },
    });

    expect(result.isError).to.be.false;
    // @ts-ignore
    expect(result.content[0].text).to.equal('Tool sf-query-org enabled\nTool sf-deploy-metadata enabled');

    const updatedTools = (await client.listTools()).tools.map((t) => t.name).sort();

    expect(updatedTools).to.deep.equal(
      ['sf-enable-tools', 'sf-get-username', 'sf-list-tools', 'sf-resume', 'sf-query-org', 'sf-deploy-metadata'].sort()
    );
  });

  it('should list available tools to be enabled', async () => {
    const result = await client.callTool({
      name: 'sf-list-tools',
    });

    expect(result.isError).to.be.false;
    // @ts-ignore
    const tools = JSON.parse(result.content[0].text);
    expect(tools.length).to.be.greaterThanOrEqual(11);
  });
});
