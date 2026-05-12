/*
 * Copyright 2026, Salesforce, Inc.
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

import { expect, assert } from 'chai';
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

  // Add a connection timeout to fail fast if the server doesn't respond
  // Increased to 90s for Windows compatibility
  const connectionTimeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('MCP client connection timeout')), 90000)
  );

  try {
    await Promise.race([client.connect(transport), connectionTimeout]);
  } catch (err) {
    await client.close();
    throw err;
  }

  return client;
}

describe('specific tool registration', function() {
  this.timeout(60000); // Set 60 second timeout for all tests in this suite

  it('should enable 2 tools', async function() {
    this.timeout(60000); // Set 60 second timeout for this test
    const client = await getMcpClient({
      args: ['--orgs', 'ALLOW_ALL_ORGS', '--tools', 'run_soql_query, deploy_metadata', '--no-telemetry'],
    });

    try {
      const initialTools = (await client.listTools()).tools.map((t) => t.name).sort();

      expect(initialTools.length).to.equal(4);
      expect(initialTools).to.deep.equal(
        ['run_soql_query', 'deploy_metadata', 'get_username', 'resume_tool_operation'].sort(),
      );
    } catch (err) {
      console.error(err);
      assert.fail();
    } finally {
      await client.close();
    }
  });

  it('should not enable NON_GA tools if --allow-non-ga-tools is not specified', async function() {
    this.timeout(60000); // Set 60 second timeout for this test
    const client = await getMcpClient({
      args: ['--orgs', 'ALLOW_ALL_ORGS', '--tools', 'run_soql_query, create_scratch_org', '--no-telemetry'],
    });

    try {
      const initialTools = (await client.listTools()).tools.map((t) => t.name).sort();

      expect(initialTools.length).to.equal(3);
      // assert that the NON_GA `create_scratch_org` tool isn't included without --allow-non-ga-tools.
      expect(initialTools).to.deep.equal(['run_soql_query', 'get_username', 'resume_tool_operation'].sort());
    } catch (err) {
      console.error(err);
      assert.fail();
    } finally {
      await client.close();
    }
  });

  it('should enable 1 tool and a toolset', async function() {
    this.timeout(90000); // Increased to 90 seconds for Windows compatibility
    const client = await getMcpClient({
      args: [
        '--orgs',
        'ALLOW_ALL_ORGS',
        '--tools',
        'run_soql_query',
        '--toolsets',
        'code-analysis',
        '--allow-non-ga-tools',
        '--no-telemetry',
      ],
    });

    try {
      const initialTools = (await client.listTools()).tools.map((t) => t.name).sort();

      expect(initialTools.length).to.equal(9);
      expect(initialTools).to.deep.equal(
        [
          'run_soql_query',
          'get_username',
          'resume_tool_operation',
          'describe_code_analyzer_rule',
          'run_code_analyzer',
          'list_code_analyzer_rules',
          'query_code_analyzer_results',
          'get_ast_nodes_to_generate_xpath',
          'create_custom_rule',
        ].sort(),
      );
    } catch (err) {
      console.error(err);
      assert.fail();
    } finally {
      await client.close();
    }
  });
});
