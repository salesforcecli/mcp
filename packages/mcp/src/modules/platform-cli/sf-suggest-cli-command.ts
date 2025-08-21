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
import { McpTool, McpToolConfig, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { getAssets } from '../../assets.js';
import { textResponse } from '../../shared/utils.js';

/**
 * Suggest a Salesforce CLI (sf) command based on user input.
 */

const suggestCliCommandParamsSchema = z.object({
  query: z.string().describe('The natural language query to suggest an `sf` command'),
});

type InputArgs = z.infer<typeof suggestCliCommandParamsSchema>;
type InputArgsShape = typeof suggestCliCommandParamsSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class SuggestCliCommandMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public getToolsets(): Toolset[] {
    return [Toolset.CORE];
  }

  public getName(): string {
    return 'sf-suggest-cli-command';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Suggest CLI Command',
      description: `Suggests an \`sf\` CLI command based on a natural language query. It finds relevant commands from a local index and uses an LLM to construct the final, precise command to fulfill the user's request.

AGENT INSTRUCTIONS:
Use this tool whenever a user:
  - asks for guidance on how to use the Salesforce CLI (sf or sfdx)
  - needs help with Salesforce CLI (sf or sfdx) command syntax
  - wants to know what Salesforce CLI (sf or sfdx) command to run for a specific task
  - asks questions like 'how do I...', 'what command...', or 'how to...' related to Salesforce development operations.
NEVER use this tool for enabling Salesforce MCP tools (use sf-enable-tools instead).
NEVER use this tool for listing available Salesforce MCP tools (use sf-list-tools instead).
NEVER use this tool for understanding the Salesforce MCP server's capabilities.
NEVER use this tool for understanding the input schema of a Salesforce MCP tool.`,
      inputSchema: suggestCliCommandParamsSchema.shape,
      outputSchema: undefined,
      annotations: {
        readOnlyHint: true
      }
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const assets = await getAssets();

    // Embed the user query
    const queryEmbedding = await assets.embedder(input.query, {
      pooling: 'mean',
      normalize: true,
    });

    // Perform Semantic Search (FAISS)
    const searchResults = assets.faissIndex.search(
      // Convert the embedding tensor data to a flat array of numbers
      Array.from(queryEmbedding.data as Float32Array),
      5
    );

    const topCandidateIds = searchResults.labels.slice(0, 5);
    const contextCommands = topCandidateIds.map((id) => {
      const command = assets.commands.find((c) => c.id === id)!;
      // Remove the embedding text to avoid sending it to the LLM
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { embeddingText, ...commandWithoutEmbeddingText } = command;
      return commandWithoutEmbeddingText;
    });

    contextCommands.forEach((command, index) => {
      // eslint-disable-next-line no-console
      console.error(`Command: ${command.command}, Score: ${searchResults.distances[index]}`);
    });

    const prompt = `System: You are a precise expert on the Salesforce CLI (sf). Your sole purpose is to construct a single, valid sf command based on the user's request and the Command Reference provided.
- Base your answer STRICTLY on the user's request and the Command Reference.
- If there is no command that matches the user's request, tell the user that you cannot find a command.
- Do not use any flags or commands not listed in the reference.

User Request:
"${input.query}"

Command Reference:
${JSON.stringify(contextCommands, null, 2)}

Notes about Flag Properties:
- multiple: Flags that support multiple values should be specified with the '--flag value1 --flag value2' syntax.
- dependsOn: If a flag depends on another flag, ensure that the dependent flag is included in the command.
- atLeastOne: If a flag requires at least one of a set of flags, ensure that at least one of those flags is included in the command.
- exactlyOne: If a flag requires exactly one of a set of flags, ensure that exactly one of those flags is included in the command.
- exclusive: If a flag is exclusive with another flag, ensure that only one of those flags is included in the command.
- required: If a flag is required, ensure that it is included in the command unless it has a default value.
- relationships: If a flag has relationships with other flags, ensure that those relationships are respected in the command.
- options: If a flag has options, ensure that one of those options is used


Synthesize the single "sf" command that best fulfills the user's request.
`;

    return textResponse(prompt);
  }
}