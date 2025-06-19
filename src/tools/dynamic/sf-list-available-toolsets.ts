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
import { TOOLSETS } from '../../shared/toolsets.js';

export const registerToolListAvailableToolsets = (server: SfMcpServer): void => {
  server.tool(
    'sf-list-available-toolsets',
    `List all available toolsets this Salesforce MCP server can offer, providing the enabled status of each.
Use this when a task could be achieved with a MCP tool and the currently available tools aren't enough.
If there's a tool that can accomplish the user's request, do not use this tool.
Call sf-get-toolset-tools with these toolset names to discover specific tools you can call.
Once you find the toolset you want to enable, call sf-enable-toolset with the toolset name.
Once you have enabled the toolset, you can call the specific tool that accomplishes the user's request.`,
    {
      readOnlyHint: true,
      title: 'List available toolsets',
      openWorldHint: false,
    },
    // eslint-disable-next-line @typescript-eslint/require-await
    async () => textResponse(`Toolsets: ${TOOLSETS.join(', ')}`)
  );
};
