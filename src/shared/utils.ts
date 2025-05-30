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

import { sep } from 'node:path';
import { EOL } from 'node:os';
import { parseArgs, ParseArgsConfig } from 'node:util';
import { type ToolTextResponse, type ParseArgsResult } from './types.js';

const usageMessage = `Usage: sf-mcp-server [OPTIONS]

FLAGS:
  -o, --orgs             - Org username(s) to allow access to.
  -t, --toolsets         - List of toolsets to enable.

FLAG DESCRIPTIONS:
  -o, --orgs=<string>  Org usernames to allow access to.

    Use this flag to specify the org usernames to allow the MCP server to access to.
    If you need to pass more than one username/alias, pass all of them as a comma-separated string.

    Special values:
    DEFAULT_TARGET_ORG     - Allow access to default orgs (global and local)
    DEFAULT_TARGET_DEV_HUB - Allow access to default dev hubs (global and local)
    ALLOW_ALL_ORGS         - Allow access to all authenticated orgs (use with caution)

  -t, --toolsets=<string>  List of toolsets to enable.

  Specify the toolsets to enable, possible values:
  * all (default)
  * orgs
  * data
  * users
  * metadata

EXAMPLES:
  // Start the server with all toolsets enabled and access only to the default org in the project:
  sf-mcp-server --orgs DEFAULT_TARGET_ORG

  // Allow access to the default org and "my-alias" one with only "data" tools;
  sf-mcp-server --orgs DEFAULT_TARGET_DEV_HUB,my-alias --toolsets data

  // Allow acccess to 3 specific orgs and enable all toolsets:
  sf-mcp-server --orgs test-org@example.com,my-dev-hub,my-alias

Documentation:
  See: https://github.com/salesforcecli/mcp`;

export function parseStartupArguments(): ParseArgsResult {
  const options: ParseArgsConfig['options'] = {
    toolsets: { type: 'string', short: 't', default: 'all' },
    orgs: { type: 'string', short: 'o' },
  };

  // TODO: strict false is to ignore flags pass at testing startup. Revisit this
  const { values } = parseArgs({
    args: process.argv,
    options,
    allowPositionals: true,
    strict: false,
  }) as unknown as ParseArgsResult;

  return { values };
}

export function buildOrgAllowList(orgs: string): Set<string> {
  // Fail if `--orgs` wasn't specified
  if (!orgs) {
    console.error(`Missing --orgs flag${EOL}${EOL}${usageMessage}`);
    process.exit(1);
  }

  // Fail if `--orgs` was specified without a value
  if (orgs === 'boolean') {
    console.error(usageMessage);
    process.exit(1);
  }
  const allOrgs = orgs.split(',').map((toolset) => toolset.trim());

  const allowedOrgs = new Set<string>();

  if (allOrgs.includes('ALLOW_ALL_ORGS')) {
    console.warn('WARNING: ALLOW_ALL_ORGS is set. This allows access to all authenticated orgs. Use with caution.');
    // TODO Add telemetry
    return new Set(['ALLOW_ALL_ORGS']);
  }

  // Process other arguments
  for (const arg of allOrgs) {
    if (arg === 'DEFAULT_TARGET_ORG' || arg === 'DEFAULT_TARGET_DEV_HUB' || arg.includes('@') || !arg.startsWith('-')) {
      allowedOrgs.add(arg);
    } else {
      console.error(`Invalid flag value: ${arg + EOL + EOL + usageMessage}`);
      process.exit(1); // Stop the server
    }
  }

  return allowedOrgs;
}

// TODO: break into two helpers? One for errors and one for success?
export function textResponse(text: string, isError: boolean = false): ToolTextResponse {
  if (text === '') throw new Error('textResponse error: "text" cannot be empty');
  return {
    isError,
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Gets the enabled toolsets based on user input and validates against available toolsets
 *
 * @param availableToolsets - The list of available toolsets
 * @param toolsetsInput - The comma-separated list of toolsets
 * @returns A Set of enabled toolsets
 */
export function getEnabledToolsets(availableToolsets: string[], toolsetsInput: string): Set<string> {
  const availableToolsetsSet = new Set<string>(availableToolsets);
  const passedToolsets = toolsetsInput.split(',').map((toolset) => toolset.trim());

  // Check if any passed toolset is not in the available list
  for (const toolset of passedToolsets) {
    if (!availableToolsetsSet.has(toolset)) {
      console.error(
        `Passed toolset "${toolset}" is not in the allowed toolset list. Available toolsets are "all (default), ${Array.from(
          availableToolsetsSet
        )
          .filter((t) => t !== 'all')
          .join(', ')}"`
      );
      process.exit(1);
    }
  }

  const enabledToolsets = new Set<string>(passedToolsets.filter((toolset) => availableToolsetsSet.has(toolset)));
  console.error('Enabling toolsets:', Array.from(enabledToolsets).join(', '));

  return enabledToolsets;
}

export function sanitizePath(path: string): boolean {
  // Decode URL-encoded sequences
  const decodedPath = decodeURIComponent(path);
  // Normalize Unicode characters
  const normalizedPath = decodedPath.normalize();

  // Check for various traversal patterns
  const hasTraversal =
    normalizedPath.includes('..') ||
    normalizedPath.includes('\\..') ||
    normalizedPath.includes('../') ||
    normalizedPath.includes('..\\') ||
    normalizedPath.includes('\u2025') || // Unicode horizontal ellipsis
    normalizedPath.includes('\u2026'); // Unicode vertical ellipsis

  // Ensure path is absolute
  const isAbsolute = path.startsWith(sep);

  return !hasTraversal && isAbsolute;
}
