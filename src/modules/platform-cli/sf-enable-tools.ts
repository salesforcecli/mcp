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

import { z } from 'zod';
import { SfMcpServer } from '../../sf-mcp-server.js';
import { textResponse } from '../../shared/utils.js';
import { enableTools } from './utils/tools.js';

const enableToolsParamsSchema = z.object({
  tools: z.array(z.string()).describe('The names of the tools to enable'),
});

export function registerToolEnableTools(server: SfMcpServer): void {
  server.tool(
    'sf-enable-tools',
    `Enable one or more of the tools the Salesforce MCP server provides.

AGENT INSTRUCTIONS:
Use sf-list-all-tools first to learn what tools are available for enabling.
Once you have enabled the tool, you MUST invoke that tool to accomplish the user's original request - DO NOT USE A DIFFERENT TOOL OR THE COMMAND LINE.`,
    enableToolsParamsSchema.shape,
    {
      title: 'Enable Salesforce MCP tools',
      readOnlyHint: true,
      openWorldHint: false,
    },
    async ({ tools }) => {
      if (tools.length === 0) {
        return textResponse('No tools specified to enable.', true);
      }

      const results = await enableTools(tools);

      server.sendToolListChanged();

      const hasError = results.some((result) => !result.success);
      const resultMessages = results.map((result) => result.message).join('\n');

      return textResponse(resultMessages, hasError);
    }
  );
}
