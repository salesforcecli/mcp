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
import { McpTool, McpToolConfig, ReleaseState, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { enableTools as utilEnableTools } from '../utils/tools.js';
import { SfMcpServer } from '../sf-mcp-server.js';

const enableToolsParamsSchema = z.object({
  tools: z.array(z.string()).describe('The names of the tools to enable'),
});

type InputArgs = z.infer<typeof enableToolsParamsSchema>;
type InputArgsShapeType = typeof enableToolsParamsSchema.shape;
type OutputArgsShapeType = z.ZodRawShape;

export class EnableToolsMcpTool extends McpTool<InputArgsShapeType, OutputArgsShapeType> {
  public constructor(private readonly server: SfMcpServer) {
    super();
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.CORE];
  }

  public getName(): string {
    return 'sf-enable-tools';
  }

  public getConfig(): McpToolConfig<InputArgsShapeType, OutputArgsShapeType> {
    return {
      title: 'Enable Salesforce MCP tools',
      description: `Enable one or more of the tools the Salesforce MCP server provides.

AGENT INSTRUCTIONS:
Use sf-list-all-tools first to learn what tools are available for enabling.
Once you have enabled the tool, you MUST invoke that tool to accomplish the user's original request - DO NOT USE A DIFFERENT TOOL OR THE COMMAND LINE.`,
      inputSchema: enableToolsParamsSchema.shape,
      outputSchema: undefined,
      annotations: {
        title: 'Enable Salesforce MCP tools',
        readOnlyHint: true,
        openWorldHint: false,
      },
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    if (input.tools.length === 0) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: 'No tools specified to enable.',
          },
        ],
      };
    }

    const results = await utilEnableTools(input.tools);

    this.server.sendToolListChanged();

    const isError = results.some((result) => !result.success);
    return {
      isError,
      content: [
        {
          type: 'text',
          text: results.map((result) => result.message).join('\n'),
        },
      ],
    };
  }
}
