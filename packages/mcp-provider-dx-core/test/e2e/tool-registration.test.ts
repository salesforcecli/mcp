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

import { expect,assert } from 'chai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { DxMcpTransport } from '@salesforce/mcp-test-client';

async function getMcpClient(opts: { args: string[] }) {
  const client = new Client({
    name: 'sf-tools',
    version: '0.0.1',
  });

  const transport = DxMcpTransport({
    args: opts.args,
  });

  await client.connect(transport);

  return client
}

describe('specific tool registration', () => {
  it('should enable 2 tools', async () => {
    const client = await getMcpClient({
      args: ['--orgs', 'ALLOW_ALL_ORGS', '--tools', 'run_soql_query, deploy_metadata', '--no-telemetry']
    })

    try {
      const initialTools = (await client.listTools()).tools.map((t) => t.name).sort();

      expect(initialTools.length).to.equal(4);
      expect(initialTools).to.deep.equal(['run_soql_query', 'deploy_metadata','get_username', 'resume_tool_operation'].sort());
    } catch (err) {
      console.error(err) 
      assert.fail()
    } finally {
      await client.close()
    }
  });

  it('should not enable NON_GA tools if --allow-non-ga-tools is not specified', async () => {
    const client = await getMcpClient({
      args: ['--orgs', 'ALLOW_ALL_ORGS', '--tools', 'run_soql_query, list_devops_center_work_items', '--no-telemetry']
    })

    try {
      const initialTools = (await client.listTools()).tools.map((t) => t.name).sort();

      expect(initialTools.length).to.equal(3);
      // assert that devops's `list_devops_center_work_items` tool isn't included.
      expect(initialTools).to.deep.equal(['run_soql_query', 'get_username', 'resume_tool_operation'].sort());
    } catch (err) {
      console.error(err)
      assert.fail()
    } finally {
      await client.close()
    }
  })

  it('should enable 1 tool and a toolset', async () => {
    const client = await getMcpClient({
      args: ['--orgs', 'ALLOW_ALL_ORGS', '--tools', 'run_soql_query', '--toolsets', 'code-analysis', '--allow-non-ga-tools','--no-telemetry']
    })

    try {
      const initialTools = (await client.listTools()).tools.map((t) => t.name).sort();

      expect(initialTools.length).to.equal(5);
      expect(initialTools).to.deep.equal(['run_soql_query', 'get_username', 'resume_tool_operation','describe_code_analyzer_rule','run_code_analyzer'].sort());
    } catch (err) {
      console.error(err)
      assert.fail()
    } finally {
      await client.close()
    }
  })
});
