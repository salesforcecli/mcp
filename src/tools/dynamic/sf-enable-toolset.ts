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
import Cache from '../../shared/cache.js';
import { textResponse } from '../../shared/utils.js';
import { TOOLSET_REGISTRY } from '../../shared/toolsets.js';

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
    // eslint-disable-next-line @typescript-eslint/require-await
    async ({ toolset }) => {
      const toolsetCache = Cache.getInstance().get('toolsets').get(toolset);
      if (!toolsetCache) {
        return textResponse(`Invalid toolset: ${toolset}. Available: ${Object.keys(TOOLSET_REGISTRY).join(', ')}`);
      }

      if (toolsetCache.enabled) {
        return textResponse(`Toolset ${toolset} is already enabled`);
      }

      toolsetCache.enabled = true;
      for (const { tool } of toolsetCache.tools) {
        tool.enable();
      }

      Cache.getInstance().get('toolsets').set(toolset, toolsetCache);

      server.sendToolListChanged();

      return textResponse(`Toolset ${toolset} enabled`);
    }
  );
}
