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
import { parseAllowedOrgs } from './shared/utils.js';
import * as orgs from './tools/orgs.js';
import * as data from './tools/data.js';
import * as users from './tools/users.js';

export const ALLOWED_ORGS = parseAllowedOrgs(process.argv);

// Create server instance
const server = new McpServer({
  name: 'sf-mcp-server',
  version: '0.0.1',
  capabilities: {
    resources: {},
    tools: {},
  },
});

// TODO: Should we add annotations to our tools? https://modelcontextprotocol.io/docs/concepts/tools#tool-definition-structure

// ************************
// ORG TOOLS
// ************************
// suggest username
orgs.registerToolSuggestUsername(server);
// list all orgs
orgs.registerToolListAllOrgs(server);
// get default org
orgs.registerToolGetDefaultOrg(server);

// ************************
// DATA TOOLS
// ************************
// query org
data.registerToolQueryOrg(server);
// create a record
data.registerToolCreateRecord(server);

// ************************
// USER TOOLS
// ************************
// assign permission set
users.registerToolAssignPermissionSet(server);

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
