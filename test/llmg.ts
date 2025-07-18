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

const API_KEY = process.env.SF_LLMG_API_KEY;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

if (!API_KEY) {
  throw new Error('SF_LLMG_API_KEY is not set');
}

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { dirname } from 'node:path';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { printTable, TableOptions } from '@oclif/table';
import { stdout, colorize } from '@oclif/core/ux';
import yaml from 'yaml';
import { Command, Flags, flush, handle } from '@oclif/core';
import { encode as encodeGPT4oMini } from 'gpt-tokenizer/model/gpt-4o-mini';
import { encode as encodeO3Mini } from 'gpt-tokenizer/model/o3-mini';
import { encode as encodeGPT4 } from 'gpt-tokenizer/model/gpt-4';

const TABLE_STYLE = {
  headerOptions: {
    formatter: 'capitalCase',
    color: 'cyanBright',
  },
  borderColor: 'gray',
  overflow: 'wrap',
} satisfies Partial<TableOptions<Record<string, unknown>>>;

type InvocableTool = {
  name: string;
  function: {
    name: string;
    description: string | undefined;
    parameters: Tool['inputSchema'];
    annotations: Tool['annotations'];
  };
};

type GatewayResponse = {
  generation_details?: {
    generations: Array<{
      content: string;
      role: string;
      tool_invocations?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    }>;
  };
};

const getToolsList = async (entryPoint: string): Promise<InvocableTool[]> => {
  const toolsList: string = await new Promise<string>((resolve, reject) => {
    const child = spawn('npx', [
      '@modelcontextprotocol/inspector',
      '--cli',
      'node',
      ...entryPoint.split(' '),
      '--method',
      'tools/list',
    ]);

    let output = '';

    child.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      reject(new Error(data.toString()));
    });

    child.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });

  const parsedToolsList = JSON.parse(toolsList) as { tools: Tool[] };

  const toolsWithTokens = parsedToolsList.tools?.map((tool) => ({
    tool: tool.name,
    tokensGPT4oMini: encodeGPT4oMini(JSON.stringify(tool)).length,
    tokensO3Mini: encodeO3Mini(JSON.stringify(tool)).length,
    tokensGPT4: encodeGPT4(JSON.stringify(tool)).length,
  }));
  toolsWithTokens.push({
    tool: colorize('bold', 'TOTAL'),
    tokensGPT4oMini: toolsWithTokens.reduce((acc, tool) => acc + tool.tokensGPT4oMini, 0),
    tokensO3Mini: toolsWithTokens.reduce((acc, tool) => acc + tool.tokensO3Mini, 0),
    tokensGPT4: toolsWithTokens.reduce((acc, tool) => acc + tool.tokensGPT4, 0),
  });

  printTable({
    title: 'Tools List',
    data: toolsWithTokens,
    columns: [
      'tool',
      { key: 'tokensGPT4oMini', name: 'GPT 4o Mini' },
      { key: 'tokensO3Mini', name: 'O3 Mini' },
      { key: 'tokensGPT4', name: 'GPT 4' },
    ],
    titleOptions: {
      color: 'yellowBright',
    },
    ...TABLE_STYLE,
  });

  return (parsedToolsList.tools ?? []).map((tool) => ({
    name: tool.name,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
      annotations: tool.annotations,
    },
  }));
};

const createRequestHeaders = (): Record<string, string> => ({
  Authorization: `API_KEY ${API_KEY}`,
  'Content-Type': 'application/json',
  // We need to figure out which tenant, context, and feature id to use
  // Maybe this is something that will be given to us once the client registration completes???
  'x-sfdc-core-tenant-id': 'core/prod1/00DDu0000008cuqMAA',
  'x-sfdc-app-context': 'EinsteinGPT',
  'x-client-feature-id': 'EinsteinDocsAnswers',
});

const createRequestBody = (
  model: string,
  tools: InvocableTool[],
  messages: Array<{ role: string; content: string }>
): string =>
  JSON.stringify({
    model,
    tools,
    tool_config: {
      mode: 'auto',
    },
    messages,
    generation_settings: {
      max_tokens: 500,
      temperature: 0.5,
      parameters: {},
    },
  });

const makeSingleGatewayRequest = async (
  model: string,
  tools: InvocableTool[],
  messages: Array<{ role: string; content: string }>
): Promise<GatewayResponse> => {
  const response = await fetch(
    'https://bot-svc-llm.sfproxy.einsteintest1.test1-uswest2.aws.sfdc.cl/v1.0/chat/generations',
    {
      method: 'POST',
      headers: createRequestHeaders(),
      body: createRequestBody(model, tools, messages),
    }
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const responseData = await response.json();
  return responseData as GatewayResponse;
};

/**
 * Makes requests to the LLM Gateway API for multiple prompts using the specified model and tools.
 *
 * @param {string[]} prompts - Array of prompts to send to the API
 * @param {string} model - The model identifier to use for generation (e.g., 'llmgateway__AzureOpenAIGPT4Omni')
 * @param {InvocableTool[]} tools - Array of tools that can be invoked by the model
 * @returns {Promise<{model: string, messages: Array<{role: string, content: string}>, responses: GatewayResponse[]}>} Object containing the model used, conversation messages, and API responses
 * @throws {Error} If any API request fails or returns an error
 *
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/get-started/#make-your-first-gateway-request} Make Your First Gateway Request Documentation
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/} Models and Providers Documentation
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/apis/rest/#operation/chatMessages} REST API Documentation
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/function-calling/} Function Calling Documentation
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/get-started/auth/#api-key-limitations} API Key Limitations Documentation
 */
const makeGatewayRequests = async (
  prompts: string[],
  model: string,
  tools: InvocableTool[]
): Promise<{ model: string; messages: Array<{ role: string; content: string }>; responses: GatewayResponse[] }> => {
  const messages: Array<{ role: string; content: string }> = [];
  const responses: GatewayResponse[] = [];

  for (const prompt of prompts) {
    // Add the current prompt to messages
    messages.push({
      role: 'user',
      content: prompt,
    });

    // eslint-disable-next-line no-await-in-loop
    const responseData = await makeSingleGatewayRequest(model, tools, messages);
    responses.push(responseData);

    // Add the assistant's response to messages for the next iteration
    if (responseData.generation_details?.generations[0]?.content) {
      messages.push({
        role: responseData.generation_details.generations[0].role,
        content: responseData.generation_details.generations[0].content,
      });
    }
  }

  return {
    responses,
    model,
    messages,
  };
};

const castToArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

async function compareModelOutputs(prompt: string | string[], models: string[], tools: InvocableTool[]) {
  const prompts = castToArray(prompt);
  const responses = await Promise.all(models.map((model) => makeGatewayRequests(prompts, model, tools)));

  printTable({
    title: `${colorize('yellowBright', 'Prompt')}:\n  - ${prompts.join('\n  - ')}`,
    data: responses.map((response) => ({
      model: response.model,
      chat: response.messages.map((m) => `${colorize('bold', m.role)}: ${m.content}`).join('\n\n'),
      tools: response.responses
        .map((r, index) => {
          const toolInvocation = r.generation_details?.generations[0].tool_invocations?.[0];
          if (!toolInvocation) {
            return `Message ${index + 1}: No tool invoked`;
          }

          const toolArgs = JSON.parse(toolInvocation.function.arguments ?? '{}') as Record<string, string>;
          const argsString = Object.entries(toolArgs)
            .map(([key, value]) => `  - ${key}: ${value}`)
            .join('\n');

          return `Message ${index + 1}: ${colorize('bold', toolInvocation.function.name)}${
            argsString ? `\n${argsString}` : ''
          }`;
        })
        .join('\n\n'),
    })),
    columns: [
      { key: 'model', width: '30%' },
      { key: 'chat', width: '40%' },
      { key: 'tools', width: '30%', name: 'Tool Invocations' },
    ],
    width: process.stdout.columns,
    ...TABLE_STYLE,
  });
}

export default class LLMGatewayTest extends Command {
  public static id = 'llm-gateway-test';
  public static summary = 'Test the MCP server against the LLM Gateway API';
  public static description = `Tests that the MCP server tools are accurately invoked by various LLM models.

Configuration:
- Uses a YAML file (default: llmg-test.yml) to specify models and test prompts
- Override the YAML file using the --file flag
- Requires SF_LLMG_API_KEY environment variable

YAML File Format:
The YAML file should contain:
- models: Array of model identifiers to test against
- prompts: Array of test prompts (can be strings or arrays of strings for multi-turn conversations)

Example YAML structure:
  models:
    - llmgateway__OpenAIGPT35Turbo_01_25
    - llmgateway__OpenAIGPT4OmniMini
  prompts:
    - "What's my salesforce username?"
    - ["I am a Salesforce developer", "Deploy my project"]
    - - I am a Salesforce developer.
      - Deploy my project

For available models, see:
https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/`;

  public static flags = {
    'entry-point': Flags.string({
      summary: 'The entry point to the MCP server',
      default: 'bin/run.js -o DEFAULT_TARGET_ORG',
      char: 'e',
    }),
    file: Flags.file({
      summary: 'The YAML file to use for the response',
      description: 'Must contain array of models and prompts',
      default: 'llmg-test.yml',
      exists: true,
      char: 'f',
    }),
    help: Flags.help({
      description: 'Show help',
      char: 'h',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(LLMGatewayTest);

    const yamlContents = await fs.readFile(flags.file, 'utf8');
    const yamlObj = yaml.parse(yamlContents) as {
      models?: string[];
      prompts?: Array<string | string[]>;
    };

    if (!yamlObj.models?.length) {
      throw new Error('At least one model is required');
    }

    if (!yamlObj.prompts?.length) {
      throw new Error('At least one prompt is required');
    }

    stdout('Models:');
    yamlObj.models.forEach((model) => stdout(`  - ${model}`));

    stdout();
    stdout('Prompts:');
    yamlObj.prompts.forEach((prompt) => {
      if (Array.isArray(prompt)) {
        stdout(`  - - ${prompt.join('\n    - ')}`);
      } else {
        stdout(`  - ${prompt}`);
      }
    });

    stdout();
    const tools = await getToolsList(flags['entry-point']);
    stdout();

    for (const prompt of yamlObj.prompts) {
      // eslint-disable-next-line no-await-in-loop
      await compareModelOutputs(prompt, yamlObj.models, tools);
    }
  }
}

LLMGatewayTest.run(process.argv.slice(2), {
  root: dirname(import.meta.dirname),
  pjson: {
    name: 'llm-gateway-test',
    version: '0.0.1',
    oclif: {
      commands: {
        strategy: 'single',
        target: 'test/llmg.js',
      },
    },
  },
}).then(
  async () => {
    await flush();
  },
  async (err) => {
    await handle(err as Error);
  }
);
