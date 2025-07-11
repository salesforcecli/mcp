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
import * as path from 'node:path';
import { google } from '@ai-sdk/google';
import { experimental_createMCPClient, generateObject, streamText, type LanguageModel } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { z } from 'zod';

// This prompt intends to represent what an IDE context window could look like, some specifics:
//
// * Current open project directory
// * Current open file
const SYSTEM_PROMPT = `You are an assistant responsible for evaluating the results of calling various tools. 

You a general purpose LLM-based Agent. Your purpose is to answer the user's query using the tools provided.

- You should ONLY use the tools available to answer the user's query.
- Use as few tool calls as possible to get to the answer.
- Using multiple tool calls to get to the answer is allowed when needed.

The current open project dir is "${process.env.SF_EVAL_PROMPT_PROJECT_DIR}"
`;

// Supported models: https://ai.google.dev/gemini-api/docs/models
const defaultModel = google('gemini-2.5-flash');

export function TaskRunner(model: LanguageModel = defaultModel) {
  return async function TaskRun(input: string) {
    const mcpClient = await experimental_createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: 'node',
        args: [path.join(import.meta.dirname, '../../bin/run.js'), '-o', 'DEFAULT_TARGET_ORG', '--no-telemetry'],
      }),
    });

    const tools = await mcpClient.tools();

    try {
      const result = streamText({
        model,
        tools,
        system: SYSTEM_PROMPT,
        prompt: input,
        maxRetries: 1,
        maxSteps: 10,
        experimental_telemetry: {
          isEnabled: false,
        },
        onError: (error) => {
          // eslint-disable-next-line no-console
          console.error(error);
        },
      });

      // TODO: we don't need text streaming here, maybe switch to `generateText`?
      // eslint-disable-next-line
      for await (const _ of result.fullStream) {
      }

      return await result.text;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      throw error;
    } finally {
      await mcpClient.close();
    }
  };
}

/**
 * A Factuality checker utilizing the `ai` SDK based on the implementation in `autoevals`.
 *
 * ```
 * import { openai } from "@ai-sdk/openai";
 *
 * scorers: [Factuality(openai("gpt-4o"))]
 * ```
 */
export function Factuality(model: LanguageModel = defaultModel) {
  // TODO: remove function wrapper
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return async function Factuality(opts: { input: string; output: string; expected?: string }) {
    const { object } = await generateObject({
      model,
      /**
       * Prompt implementation from `autoevals`:
       *
       * {@link https://github.com/braintrustdata/autoevals/blob/5aa20a0a9eb8fc9e07e9e5722ebf71c68d082f32/templates/factuality.yaml}
       */
      prompt: `
        You are comparing a submitted answer to an expert answer on a given question. Here is the data:

        [BEGIN DATA]
        ************
        [Question]: ${opts.input}
        ************
        [Expert]: ${opts.expected}
        ************
        [Submission]: ${opts.output}
        ************
        [END DATA]

        Compare the factual content of the submitted answer with the expert answer. Ignore any differences in style, grammar, or punctuation, or overall structure.

        The submitted answer may either be a subset or superset of the expert answer, or it may conflict with it. Determine which case applies. Answer the question by selecting one of the following options:
        
        (A) The submitted answer is a subset of the expert answer and is fully consistent with it.
        (B) The submitted answer is a superset of the expert answer and is fully consistent with it.
        (C) The submitted answer contains all the same details as the expert answer.
        (D) There is a disagreement between the submitted answer and the expert answer.
        (E) The answers differ, but these differences don't matter from the perspective of factuality.
      `,
      schema: z.object({
        answer: z.enum(['A', 'B', 'C', 'D', 'E']).describe('Your selection.'),
        rationale: z.string().describe('Why you chose this answer. Be very detailed.'),
      }),
    });

    const scores = {
      A: 0.4,
      B: 0.6,
      C: 1,
      D: 0,
      E: 1,
    };

    return {
      score: scores[object.answer],
      metadata: {
        rationale: object.rationale,
      },
    };
  };
}
