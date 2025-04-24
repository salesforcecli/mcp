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

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const execAsync = promisify(exec);

// Create server instance
const server = new McpServer({
  name: 'sf-mcp-server',
  version: '0.0.1', // TODO: pull from package.json
  capabilities: {
    resources: {},
    tools: {},
  },
});

server.tool(
  'run-soql-query',
  'Runs a SOQL query against a Salesforce instance.',
  {
    soql_query: z.string().describe('SOQL query'),
  },
  async ({ soql_query }) => {
    try {
      const { stdout } = await execAsync(`sf data query -q "${soql_query}" -o foo --json`);
      return {
        content: [
          {
            type: 'text',
            text: `Results of the "${soql_query}" SOQL query in JSON format:\n\n${stdout}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to run the query: ${JSON.stringify(error)}`,
          },
        ],
      };
    }
  }
);

server.tool(
  'org-details',
  'Gets details of a locally configured Salesforce org.',
  {
    org_name_or_alias: z.string().describe('Name or alias of the Salesforce org'),
  },
  async ({ org_name_or_alias }) => {
    try {
      const { stdout } = await execAsync(`sf org display -o ${org_name_or_alias} --json`);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const safeStdout = JSON.parse(stdout);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      delete safeStdout.result.accessToken;
      return {
        content: [
          {
            type: 'text',
            text: `Results of the "${org_name_or_alias}" org display command in JSON format (access token removed):\n\n${safeStdout}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get org information: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // eslint-disable-next-line no-console
  console.error('✅ Salesforce MCP Server running on stdio');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error in main():', error);
  process.exit(1);
});
