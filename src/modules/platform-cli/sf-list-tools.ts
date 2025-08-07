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

import { SfMcpServer } from '../../sf-mcp-server.js';
import { textResponse } from '../../shared/utils.js';
import { listAllTools } from './utils/tools.js';

export function registerToolListTools(server: SfMcpServer): void {
  server.tool(
    'sf-list-tools',
    `List all available tools this Salesforce MCP server can offer, providing the enabled status and description of each.

AGENT INSTRUCTIONS:
DO NOT USE THIS TOOL if you already know what tool you need - try to call the tool directly first.
ONLY use this tool if:
1. You tried to call a tool and got an error that it doesn't exist or isn't enabled
2. You genuinely don't know what tools are available for a specific task
3. You need to discover new tools for an unfamiliar use case

If you find one or more tools you want to enable, call sf-enable-tools with all the tool names.
Once you have enabled a tool, you MUST invoke the tool to accomplish the user's original request - DO NOT USE A DIFFERENT TOOL OR THE COMMAND LINE.
Once a tool has been enabled, you do not need to call sf-list-tools again - instead, invoke the desired tool directly.`,
    {
      title: 'List all individual tools',
      readOnlyHint: true,
      openWorldHint: false,
    },
    async () => textResponse(JSON.stringify(await listAllTools(), null, 2))
  );
}
