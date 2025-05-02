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

import { suggestUsername } from '../shared/auth.js';
import { type ToolTextResponse } from './types.js';

export function parseAllowedOrgs(args: string[]): Set<string> {
  // Depending how this server is started, the argv values vary
  // TODO: look at native flags parser.
  const executableIndex = args.findIndex((arg) => arg.endsWith('.js') || arg.endsWith('sf-mcp-server'));
  if (executableIndex === -1) {
    console.error('Something went wrong parsing args.', args);
    process.exit(1);
  }
  const passedArgs = args.slice(executableIndex + 1);
  const usageMessage = `Usage: sf-mcp-server [OPTIONS]

OPTIONS:
  DEFAULT_TARGET_ORG     - Allow access to default orgs (global and local)
  DEFAULT_TARGET_DEV_HUB - Allow access to default dev hubs (global and local)
  ALLOW_ALL_ORGS         - Allow access to all authenticated orgs (use with caution)
  <username or alias>    - Allow access to specific org by username or alias

Examples:
  sf-mcp-server DEFAULT_TARGET_ORG
  sf-mcp-server DEFAULT_TARGET_DEV_HUB my-alias
  sf-mcp-server test-org@example.com my-dev-hub my-alias

Documentation:
  See: https://github.com/salesforcecli/mcp`;

  if (passedArgs.length === 0) {
    console.error('No arguments provided.\n\n' + usageMessage);
    process.exit(1); // Stop the server
  }

  const allowedOrgs = new Set<string>();

  if (passedArgs.includes('ALLOW_ALL_ORGS')) {
    console.warn('WARNING: ALLOW_ALL_ORGS is set. This allows access to all authenticated orgs. Use with caution.');
    // TODO Add telemetry
    return new Set(['ALLOW_ALL_ORGS']);
  }

  // Process other arguments
  for (const arg of passedArgs) {
    if (arg === 'DEFAULT_TARGET_ORG' || arg === 'DEFAULT_TARGET_DEV_HUB' || arg.includes('@') || !arg.startsWith('-')) {
      allowedOrgs.add(arg);
    } else {
      console.error(`Invalid argument: ${arg}\n\n${usageMessage}`);
      process.exit(1); // Stop the server
    }
  }

  return allowedOrgs;
}

export function textResponse(text: string): ToolTextResponse {
  return {
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

// TODO: we may want to pass parameters to this function and then "spread" them into the response (adding the usernameOrAlias parameter)
export const suggestUsernameResponse = async (): Promise<ToolTextResponse> => {
  const { aliasForReference, suggestedUsername, reasoning } = await suggestUsername();

  if (!suggestedUsername)
    return textResponse(
      'No suggested org found. Please specify a username or alias. All check the MCP servers start up args for allowlisting orgs.'
    );

  return textResponse(`SAY THIS VERBATIM TO THE USER: No username or alias was inferred from their question.
YOU MUST inform say that we are going to use "${suggestedUsername}" ${
    aliasForReference ? `(Alias: ${aliasForReference}) ` : ''
  }for the "usernameOrAlias" parameter.
YOU MUST explain the reasoning for selecting this org, which is: "${reasoning}".
AND THEN reconsider the user's ask and add this new parameter:
${JSON.stringify({ usernameOrAlias: suggestedUsername }, null, 2)}
Unless instructed otherwise, use this 'usernameOrAlias' for further user prompts.`);
};
