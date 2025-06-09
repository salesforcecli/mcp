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
import { Command, Flags, ux } from '@oclif/core';
import * as core from './tools/core/index.js';
import * as orgs from './tools/orgs/index.js';
import * as data from './tools/data/index.js';
import * as users from './tools/users/index.js';
import * as metadata from './tools/metadata/index.js';
import Cache from './shared/cache.js';

const TOOLSETS = ['all', 'orgs', 'data', 'users', 'metadata'] as const;

export default class McpServerCommand extends Command {
  public static summary = 'Start the Salesforce MCP server';
  public static description = `This command starts the Model Context Protocol (MCP) server for Salesforce, allowing access to various tools and orgs.

See: https://github.com/salesforcecli/mcp
  `;

  public static flags = {
    orgs: Flags.string({
      char: 'o',
      summary: 'Org usernames to allow access to',
      description: `If you need to pass more than one username/alias, separate them with commas.

You can also use special values to control access to orgs:
- DEFAULT_TARGET_ORG: Allow access to default orgs (global and local)
- DEFAULT_TARGET_DEV_HUB: Allow access to default dev hubs (global and local)
- ALLOW_ALL_ORGS: Allow access to all authenticated orgs (use with caution)`,
      required: true,
      multiple: true,
      delimiter: ',',
      parse: async (input: string) => {
        if (input === 'ALLOW_ALL_ORGS') {
          ux.warn('WARNING: ALLOW_ALL_ORGS is set. This allows access to all authenticated orgs. Use with caution.');
        }

        if (
          input === 'DEFAULT_TARGET_ORG' ||
          input === 'DEFAULT_TARGET_DEV_HUB' ||
          input.includes('@') ||
          !input.startsWith('-')
        ) {
          return Promise.resolve(input);
        }

        ux.error(
          `Invalid org input: "${input}". Please provide a valid org username or alias, or use one of the special values: DEFAULT_TARGET_ORG, DEFAULT_TARGET_DEV_HUB, ALLOW_ALL_ORGS.`
        );
      },
    }),
    toolsets: Flags.option({
      options: TOOLSETS,
      char: 't',
      summary: 'Toolset to enable',
      multiple: true,
      delimiter: ',',
      default: ['all'],
    })(),
  };

  public static examples = [
    {
      description: 'Start the server with all toolsets enabled and access only to the default org in the project',
      command: '<%= config.bin %> --orgs DEFAULT_TARGET_ORG',
    },
    {
      description: 'Allow access to the default org and "my-alias" one with only "data" tools',
      command: '<%= config.bin %> --orgs DEFAULT_TARGET_DEV_HUB,my-alias --toolsets data',
    },
    {
      description: 'Allow access to 3 specific orgs and enable all toolsets',
      command: '<%= config.bin %> --orgs test-org@example.com,my-dev-hub,my-alias',
    },
  ];

  public async run(): Promise<void> {
    const { flags } = await this.parse(McpServerCommand);
    Cache.getInstance().set('allowedOrgs', new Set(flags.orgs));
    this.logToStderr(`Allowed orgs:\n${flags.orgs.map((org) => `- ${org}`).join('\n')}`);
    const server = new McpServer({
      name: 'sf-mcp-server',
      version: '0.0.6',
      capabilities: {
        resources: {},
        tools: {},
      },
    });

    // // TODO: Should we add annotations to our tools? https://modelcontextprotocol.io/docs/concepts/tools#tool-definition-structure
    // // TODO: Move tool names into a shared file, that way if we reference them in multiple places, we can update them in one place

    const enabledToolsets = new Set(flags.toolsets);
    const all = enabledToolsets.has('all');

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
    }

    // ************************
    // USER TOOLS
    // ************************
    if (all || enabledToolsets.has('users')) {
      // assign permission set
      users.registerToolAssignPermissionSet(server);
    }

    // ************************
    // METADATA TOOLS
    // ************************
    if (all || enabledToolsets.has('metadata')) {
      // deploy metadata
      metadata.registerToolDeployMetadata(server);
      // retrieve metadata
      metadata.registerToolRetrieveMetadata(server);
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('✅ Salesforce MCP Server running on stdio');
  }
}
