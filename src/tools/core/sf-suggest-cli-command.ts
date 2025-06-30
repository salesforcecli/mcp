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
import { getAssets } from '../../assets.js';
import { textResponse } from '../../shared/utils.js';

const suggestCliCommandParamsSchema = z.object({
  query: z.string().describe('The natural language query to suggest an `sf` command'),
});

/**
 * Suggest a Salesforce CLI (sf) command based on user input.
 */
export const registerToolSuggestCliCommand = (server: SfMcpServer): void => {
  server.tool(
    'sf-suggest-cli-command',
    "Suggests an `sf` CLI command based on a natural language query. It finds relevant commands from a local index and uses an LLM to construct the final, precise command to fulfill the user's request.",
    suggestCliCommandParamsSchema.shape,
    {
      readOnlyHint: true,
    },
    async ({ query }) => {
      const assets = await getAssets();

      // Embed the user query
      const queryEmbedding = await assets.embedder(query, {
        pooling: 'mean',
        normalize: true,
      });

      // Perform Semantic Search (FAISS)
      const searchResults = assets.faissIndex.search(
        // Convert the embedding to a flat array of numbers
        Array.from(queryEmbedding.data).map((val: unknown) => Number(val)),
        5
      );

      const topCandidateIds = searchResults.labels.slice(0, 5);
      const contextCommands = topCandidateIds.map((id) => assets.commands.find((c) => c.id === id));

      // eslint-disable-next-line no-console
      console.error('top candidates');
      for (const cmd of contextCommands) {
        if (!cmd) continue;
        // eslint-disable-next-line no-console
        console.error(`- ${cmd.command}: ${searchResults.distances[contextCommands.indexOf(cmd)]}`);
      }

      const prompt = `System: You are a precise expert on the Salesforce CLI (sf). Your sole purpose is to construct a single, valid sf command based on the user's request and the Command Reference provided.
- Base your answer STRICTLY on the user's request and the Command Reference.
- Do not use any flags or commands not listed in the reference.
- Do not add any explanation. Only output the final command.

User Request:
"${query}"

Command Reference:
${JSON.stringify(contextCommands, null, 2)}

Synthesize the single "sf" command that best fulfills the user's request.
`;

      return textResponse(prompt);
    }
  );
};
