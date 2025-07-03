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
import { enableTool } from '../../shared/tools.js';

const enableToolParamsSchema = z.object({
  tool: z.string().describe('The name of the tool to enable'),
});

export function registerToolEnableTool(server: SfMcpServer): void {
  server.tool(
    'sf-enable-tool',
    `Enable one of the tools the Salesforce MCP server provides.

AGENT INSTRUCTIONS:
use sf-list-all-tools first to learn what tools are available for enabling'`,
    enableToolParamsSchema.shape,
    {
      title: 'Enable an individual tool',
      readOnlyHint: true,
      openWorldHint: false,
    },
    async ({ tool }) => {
      const result = await enableTool(tool);

      if (result.success) {
        server.sendToolListChanged();
      }

      return textResponse(result.message, !result.success);
    }
  );
}
