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

import z from 'zod';
import { SfMcpServer } from '../../sf-mcp-server.js';
import { textResponse } from '../../shared/utils.js';
import { isValidToolset, getAvailableToolsets, enableToolset } from '../../shared/toolset-management.js';

export const enableToolsetParamsSchema = z.object({
  toolset: z.string().describe('The name of the toolset to enable'),
});

export type EnableToolsetParamsSchema = z.infer<typeof enableToolsetParamsSchema>;

export function registerToolEnableToolset(server: SfMcpServer): void {
  server.tool(
    'sf-enable-toolset',
    'Enable one of the sets of tools the Salesforce MCP server provides, use sf-get-toolset-tools and sf-list-available-toolsets first to see what this will enable',
    enableToolsetParamsSchema.shape,
    {
      title: 'Enable a toolset',
      readOnlyHint: true,
      openWorldHint: false,
    },
    async ({ toolset }) => {
      // Validate toolset exists
      if (!isValidToolset(toolset)) {
        return textResponse(`Invalid toolset: ${toolset}. Available: ${getAvailableToolsets().join(', ')}`);
      }

      const result = await enableToolset(toolset);

      if (result.success) {
        server.sendToolListChanged();
      }

      return textResponse(result.message);
    }
  );
}
