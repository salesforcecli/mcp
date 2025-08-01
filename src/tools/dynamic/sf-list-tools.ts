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
import { listAllTools } from '../../shared/tools.js';
import { getToolSearchAssets } from '../../assets.js';

const listToolsParamsSchema = z.object({
  query: z
    .string()
    .describe(
      "A description of what you are trying to accomplish or the user's original request that led you to need to discover available tools"
    ),
});

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

When calling this tool, provide a description of what you're trying to accomplish in the query parameter.
Examples: "deploy a file to Salesforce org", "create a scratch org", "retrieve metadata from org"

If you find one or more tools you want to enable, call sf-enable-tools with all the tool names.
Once you have enabled a tool, you MUST invoke the tool to accomplish the user's original request - DO NOT USE A DIFFERENT TOOL OR THE COMMAND LINE.
Once a tool has been enabled, you do not need to call sf-list-tools again - instead, invoke the desired tool directly.`,
    listToolsParamsSchema.shape,
    {
      title: 'List all individual tools',
      readOnlyHint: true,
      openWorldHint: false,
    },
    async ({ query }) => {
      const assets = await getToolSearchAssets();

      // Embed the user query
      const queryEmbedding = await assets.embedder(query, {
        pooling: 'mean',
        normalize: true,
      });

      // Perform Semantic Search (FAISS)
      const searchResults = assets.faissIndex.search(
        // Convert the embedding tensor data to a flat array of numbers
        Array.from(queryEmbedding.data as Float32Array),
        5
      );

      const allTools = await listAllTools();
      const enabledToolNames = new Set(allTools.filter((tool) => tool.enabled).map((tool) => tool.name));

      // Filter search results to exclude enabled tools and get top 5
      const filteredResults = searchResults.labels
        .map((id) => assets.tools.find((c) => c.id === id)!)
        .filter((tool) => !enabledToolNames.has(tool.name))
        .slice(0, 5);

      const tools = allTools.filter((tool) => filteredResults.some((t) => t.name === tool.name));

      return textResponse(JSON.stringify(tools, null, 2));
    }
  );
}
