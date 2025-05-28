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
import { parseStartupArguments, getEnabledToolsets } from './shared/utils.js';
import * as core from './tools/core/index.js';
import * as orgs from './tools/orgs/index.js';
import * as data from './tools/data/index.js';
import * as users from './tools/users/index.js';

// Create server instance
const server = new McpServer({
  name: 'sf-mcp-server',
  version: '0.0.6',
  capabilities: {
    resources: {},
    tools: {},
  },
});

const { values } = parseStartupArguments();

// Toolsets will always be set. It is 'all' by default
const availableToolsets = ['all', 'orgs', 'data', 'users'];
const enabledToolsets = getEnabledToolsets(availableToolsets, values.toolsets);
const all = enabledToolsets.has('all');

// TODO: Should we add annotations to our tools? https://modelcontextprotocol.io/docs/concepts/tools#tool-definition-structure
// TODO: Move tool names into a shared file, that way if we reference them in multiple places, we can update them in one place

// ************************
// CORE TOOLS (always on)
// ************************
// get username
core.registerToolGetUsername(server);

// ************************
// ORG TOOLS
// ************************
if (all || enabledToolsets.has('orgs')) {
  // list all orgs
  orgs.registerToolListAllOrgs(server);
}

// ************************
// DATA TOOLS
// ************************
if (all || enabledToolsets.has('data')) {
  // query org
  data.registerToolQueryOrg(server);
  // create a record
  data.registerToolCreateRecord(server);
}

// ************************
// USER TOOLS
// ************************
if (all || enabledToolsets.has('users')) {
  // assign permission set
  users.registerToolAssignPermissionSet(server);
}

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('✅ Salesforce MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
