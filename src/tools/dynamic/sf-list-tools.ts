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
import { listAllTools } from '../../shared/tools.js';

export function registerToolListTools(server: SfMcpServer): void {
  server.tool(
    'sf-list-tools',
    `List all available tools this Salesforce MCP server can offer, providing the enabled status and description of each.

AGENT INSTRUCTIONS:
Use this when a task could be achieved with a MCP tool and the currently available tools aren't enough.
If there's a tool that can accomplish the user's request, do not use this tool.
Once you find the tool you want to enable, call sf-enable-tool with the tool name.
Once you have enabled the tool, you can invoke the tool to accomplish the user's request.`,
    {
      title: 'List all individual tools',
      readOnlyHint: true,
      openWorldHint: false,
    },
    async () => textResponse(JSON.stringify(await listAllTools(), null, 2))
  );
}
