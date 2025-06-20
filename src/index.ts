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

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Command, Flags, ux } from '@oclif/core';
import * as core from './tools/core/index.js';
import * as orgs from './tools/orgs/index.js';
import * as data from './tools/data/index.js';
import * as users from './tools/users/index.js';
import * as metadata from './tools/metadata/index.js';
import * as dynamic from './tools/dynamic/index.js';
import Cache from './shared/cache.js';
import { Telemetry } from './telemetry.js';
import { SfMcpServer } from './sf-mcp-server.js';
import { TOOLSETS } from './shared/tools.js';

/**
 * Sanitizes an array of org usernames by replacing specific orgs with a placeholder.
 * Special values (DEFAULT_TARGET_ORG, DEFAULT_TARGET_DEV_HUB, ALLOW_ALL_ORGS) are preserved.
 *
 * @param {string[]} input - Array of org identifiers to sanitize
 * @returns {string} Comma-separated string of sanitized org identifiers
 */
function sanitizeOrgInput(input: string[]): string {
  return input
    .map((org) => {
      if (org === 'DEFAULT_TARGET_ORG' || org === 'DEFAULT_TARGET_DEV_HUB' || org === 'ALLOW_ALL_ORGS') {
        return org;
      }

      return 'SANITIZED_ORG';
    })
    .join(', ');
}

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
          ux.warn('ALLOW_ALL_ORGS is set. This allows access to all authenticated orgs. Use with caution.');
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
      options: ['all', ...TOOLSETS] as const,
      char: 't',
      summary: 'Toolset to enable',
      multiple: true,
      delimiter: ',',
      exclusive: ['dynamic-toolsets'],
    })(),
    version: Flags.version(),
    'no-telemetry': Flags.boolean({
      summary: 'Disable telemetry',
    }),
    debug: Flags.boolean({
      summary: 'Enable debug logging',
    }),
    'dynamic-toolsets': Flags.boolean({
      summary: 'Enable dynamic toolsets',
      char: 'd',
      exclusive: ['toolsets'],
    }),
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

  private telemetry?: Telemetry;

  public async run(): Promise<void> {
    const { flags } = await this.parse(McpServerCommand);

    if (!flags['no-telemetry']) {
      this.telemetry = new Telemetry(this.config, {
        toolsets: (flags.toolsets ?? []).join(', '),
        orgs: sanitizeOrgInput(flags.orgs),
      });

      await this.telemetry.start();

      process.stdin.on('close', (err) => {
        this.telemetry?.sendEvent(err ? 'SERVER_STOPPED_ERROR' : 'SERVER_STOPPED_SUCCESS');
        this.telemetry?.stop();
      });
    }

    await Cache.safeSet('allowedOrgs', new Set(flags.orgs));
    this.logToStderr(`Allowed orgs:\n${flags.orgs.map((org) => `- ${org}`).join('\n')}`);
    const server = new SfMcpServer(
      {
        name: 'sf-mcp-server',
        version: this.config.version,
        capabilities: {
          resources: {},
          tools: {},
        },
      },
      {
        telemetry: this.telemetry,
        dynamicToolsets: flags['dynamic-toolsets'] ?? false,
      }
    );

    // // TODO: Should we add annotations to our tools? https://modelcontextprotocol.io/docs/concepts/tools#tool-definition-structure
    // // TODO: Move tool names into a shared file, that way if we reference them in multiple places, we can update them in one place

    const enabledToolsets = new Set(flags.toolsets);
    const all = enabledToolsets.has('all');

    // ************************
    // CORE TOOLS (always on)
    // ************************
    this.logToStderr('Registering core tools');
    // get username
    core.registerToolGetUsername(server);

    // DYNAMIC TOOLSETS
    // ************************
    if (flags['dynamic-toolsets']) {
      this.logToStderr('Registering dynamic toolsets');
      // Individual tool management
      dynamic.registerToolEnableTool(server);
      dynamic.registerToolListAllTools(server);
    }

    // ************************
    // ORG TOOLS
    // ************************
    if (flags['dynamic-toolsets'] || all || enabledToolsets.has('orgs')) {
      this.logToStderr('Registering org tools');
      // list all orgs
      orgs.registerToolListAllOrgs(server);
    }

    // ************************
    // DATA TOOLS
    // ************************
    if (flags['dynamic-toolsets'] || all || enabledToolsets.has('data')) {
      this.logToStderr('Registering data tools');
      // query org
      data.registerToolQueryOrg(server);
    }

    // ************************
    // USER TOOLS
    // ************************
    if (flags['dynamic-toolsets'] || all || enabledToolsets.has('users')) {
      this.logToStderr('Registering user tools');
      // assign permission set
      users.registerToolAssignPermissionSet(server);
    }

    // ************************
    // METADATA TOOLS
    // ************************
    if (flags['dynamic-toolsets'] || all || enabledToolsets.has('metadata')) {
      this.logToStderr('Registering metadata tools');
      // deploy metadata
      metadata.registerToolDeployMetadata(server);
      // retrieve metadata
      metadata.registerToolRetrieveMetadata(server);
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error(`✅ Salesforce MCP Server v${this.config.version} running on stdio`);
  }

  protected async catch(error: Error): Promise<void> {
    if (!this.telemetry && !process.argv.includes('--no-telemetry')) {
      this.telemetry = new Telemetry(this.config);
      await this.telemetry.start();
    }

    this.telemetry?.sendEvent('START_ERROR', {
      error: error.message,
      stack: error.stack,
    });

    await super.catch(error);
  }
}
