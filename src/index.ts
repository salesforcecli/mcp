#!/usr/bin/env node
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

/* eslint-disable no-console */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// import { z } from 'zod';
import { getOrgs } from './shared/auth.js';
import { parseAllowedOrgs } from './shared/utils.js';

export const ALLOWED_ORGS = parseAllowedOrgs(process.argv);

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
  'sf-list-all-orgs',
  'Lists all configured Salesforce orgs.',
  {
    // skipConnectionStatus: z.boolean().default(false).optional().describe('Skip checking connection status of the orgs'),
  },
  async () => {
    try {
      const orgs = await getOrgs();
      return {
        content: [
          {
            type: 'text',
            text: `List of configured Salesforce orgs:\n\n${JSON.stringify(orgs, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list orgs: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ Salesforce MCP Server running on stdio');
  console.error(' - Allowed orgs:', ALLOWED_ORGS);
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
