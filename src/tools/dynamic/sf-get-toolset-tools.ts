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
import { getToolsetStatus } from '../../shared/toolset-management.js';

export const getToolsetToolsParamsSchema = z.object({
  toolset: z.string().describe('The name of the toolset to get the tools for'),
});

export type GetToolsetToolsParamsSchema = z.infer<typeof getToolsetToolsParamsSchema>;

export function registerToolGetToolsetTools(server: SfMcpServer): void {
  server.tool(
    'sf-get-toolset-tools',
    'Lists all the capabilities that are enabled with the specified toolset, use this to get clarity on whether enabling a toolset would help you to complete a task',
    getToolsetToolsParamsSchema.shape,
    {
      readOnlyHint: true,
      openWorldHint: false,
      title: 'List all tools in a toolset',
    },
    async ({ toolset }) => {
      const toolsetStatus = await getToolsetStatus(toolset);

      if (!toolsetStatus) {
        return textResponse(`Toolset ${toolset} not found`);
      }

      const tools = toolsetStatus.tools.map(({ tool, name }) => ({
        name,
        description: tool.description,
        enabled: tool.enabled,
        toolset,
      }));

      return textResponse(JSON.stringify(tools, null, 2));
    }
  );
}
