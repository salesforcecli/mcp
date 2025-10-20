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
import * as fs from 'node:fs';
import * as os from 'node:os';
import { google } from '@ai-sdk/google';
import { experimental_createMCPClient, generateText, type LanguageModel } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { TaskResult } from 'vitest-evals';

function generateSystemPrompt(opts?: runnerOptions['promptOptions']): string {
  let prompt = `You are an assistant responsible for evaluating the results of calling various tools. 
You a general purpose LLM-based Agent. Your purpose is to answer the user's query using the tools provided.
- You should ONLY use the tools available to answer the user's query.
- Use as few tool calls as possible to get to the answer.
- Using multiple tool calls to get to the answer is allowed when needed.
`;

  if (opts) {
    prompt += `
<workspace_info>
I am working in a workspace with the following folders:
- ${opts.currentOpenWorkspace}
</workspace_info>

<editorContext>
The user's current file is ${opts.currentOpenFile} 
</editorContext>
`;
  }

  return prompt;
}

// Supported models: https://ai.google.dev/gemini-api/docs/models
const defaultModel = google('gemini-2.5-flash');

type runnerOptions = {
  model?: LanguageModel;
  promptOptions?: {
    currentOpenWorkspace: string;
    currentOpenFile: string;
  };
};

export function TaskRunner(opts?: runnerOptions) {
  return async function TaskRun(input: string): Promise<TaskResult> {
    const mcpClient = await experimental_createMCPClient({
      transport: new Experimental_StdioMCPTransport({
        command: 'node',
        args: [
          path.join(import.meta.dirname, '../../../bin/run.js'),
          '--toolsets',
          'all',
          '-o',
          'DEFAULT_TARGET_ORG',
          '--no-telemetry',
          '--allow-non-ga-tools',
        ],
        // IMPORTANT:
        // this is needed because testkit sets it when transferring the hub auth and creating a scratch.
        // Without it you get a keychain error/silent failure because the server will look for orgUsername
        // in the OS keychain but testkit modifies the home dir in the process so all auth is in the test dir.
        env: {
          SF_USE_GENERIC_UNIX_KEYCHAIN: 'true',
        },
      }),
    });

    const tools = await mcpClient.tools();

    const systemPrompt = generateSystemPrompt(opts?.promptOptions);

    try {
      const { text, steps } = await generateText({
        model: opts?.model ?? defaultModel,
        tools,
        system: systemPrompt,
        prompt: input,
        maxRetries: 1,
        maxSteps: 10,
        experimental_telemetry: {
          isEnabled: false,
        },
      });

      if (process.env.SF_MCP_DEBUG_EVALS === 'true') {
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `eval-result-${Date.now()}.json`);
        const debugData = {
          input,
          result: text,
          toolCalls: steps
            .flatMap((step) => step.toolCalls)
            .map((call) => ({
              name: call.toolName,
              arguments: call.args,
            })),
          systemPrompt,
          timestamp: new Date().toISOString(),
        };
        fs.writeFileSync(tmpFile, JSON.stringify(debugData, null, 2));
        // eslint-disable-next-line no-console
        console.warn(`Debug: Result written to ${tmpFile}`);
      }

      return {
        result: text,
        // vitest-evals expects args to be:
        // ```ts
        // arguments?: Record<string, any>
        // ```
        //
        // but ai-sdk v3/google adapter returns args as:
        // ```ts
        // args: unknown;
        // ```
        //
        // revisit if this got fixed after migrating to ai-sdk v5 with the LLGM adapter
        // @ts-ignore
        toolCalls: steps
          .flatMap((step) => step.toolCalls)
          .map((call) => ({
            name: call.toolName,
            arguments: call.args,
          })),
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      throw error;
    } finally {
      await mcpClient.close();
    }
  };
}

export function NoOpTaskRunner() {
  return async function NoOpTaskRunner(input: string) {
    // Just return the input as the result, no tool execution
    return {
      result: input,
      toolCalls: [],
    };
  };
}
