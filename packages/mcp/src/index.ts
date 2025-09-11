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

import { TOOLSETS } from '@salesforce/mcp-provider-api';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Command, Flags, ux } from '@oclif/core';
import Cache from './utils/cache.js';
import { Telemetry } from './telemetry.js';
import { SfMcpServer } from './sf-mcp-server.js';
import { registerToolsets } from './utils/registry-utils.js';
import { Services } from './services.js';

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
    'dynamic-tools': Flags.boolean({
      summary: 'Enable dynamic toolsets',
      char: 'd',
      exclusive: ['toolsets'],
    }),
    'allow-non-ga-tools': Flags.boolean({
      summary: 'Enable the ability to register tools that are not yet generally available (GA)',
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
    {
      description: 'Allow tools that are not generally available (GA) to be registered with the server',
      command: '<%= config.bin %> --orgs DEFAULT_TARGET_ORG --allow-non-ga-tools',
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
      }
    );

    const services = new Services({
      telemetry: this.telemetry,
      dataDir: this.config.dataDir,
      // Startup flags that could be useful to reference inside of a MCP tool
      startupFlags: {
        // !! Never pass the 'orgs' flag here. Use 'getOrgService()'.
        'allow-non-ga-tools': flags['allow-non-ga-tools'],
        debug: flags.debug
      }
    });

    await registerToolsets(
      flags.toolsets ?? ['all'],
      flags['dynamic-tools'] ?? false,
      flags['allow-non-ga-tools'] ?? false,
      server,
      services
    );

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
