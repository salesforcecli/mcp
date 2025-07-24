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

import { Model } from './models.js';
import { InvocableTool } from './tools.js';
import { RateLimiter } from './rate-limiter.js';

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

const createRequestHeaders = (apiKey: string): Record<string, string> => ({
  Authorization: `API_KEY ${apiKey}`,
  'Content-Type': 'application/json',
  // taken from example in docs. Theoretically we'd have our own after fully onboarding?
  // https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/access/gateway-access/
  'x-sfdc-core-tenant-id': 'core/prod1/00DDu0000008cuqMAA',
  // https://git.soma.salesforce.com/einsteingpt/module-llmg-cts-registry/blob/master/docs/features/PLATFORM_C_L_I_M_C_P_TESTS.yml
  'x-sfdc-app-context': 'EinsteinGPT',
  'x-client-feature-id': 'platform-cli-mcp-tests',
});

const createRequestBody = (
  model: Model,
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

// We're using a pre-production environment so we currently have the default 40 requests per minute per client-feature-id.
// See: https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/rate-limits/#pre-production-environments
const rateLimiter = new RateLimiter(40, 60_000);

const makeSingleGatewayRequest = async (
  apiKey: string,
  model: Model,
  tools: InvocableTool[],
  messages: Array<{ role: string; content: string }>
): Promise<GatewayResponse> => {
  const response = await rateLimiter.enqueue(async () =>
    fetch('https://bot-svc-llm.sfproxy.einsteintest1.test1-uswest2.aws.sfdc.cl/v1.0/chat/generations', {
      method: 'POST',
      headers: createRequestHeaders(apiKey),
      body: createRequestBody(model, tools, messages),
    })
  );

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error(`Error making request to LLM Gateway API: ${response.status} ${response.statusText}`);
    // eslint-disable-next-line no-console
    console.error('Response body:', JSON.stringify(await response.json(), null, 2));
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const responseData = await response.json();
  return responseData as GatewayResponse;
};

/**
 * Makes requests to the LLM Gateway API for multiple utterances using the specified model and tools.
 *
 * @param {string} apiKey - API key for authentication with the LLM Gateway
 * @param {string[]} utterances - Array of utterances to send to the API
 * @param {Model} model - The model identifier to use for generation
 * @param {InvocableTool[]} tools - Array of tools that can be invoked by the model
 * @param {string[]} [initialContext] - Optional initial context messages to prepend to the conversation
 * @returns {Promise<{model: Model, messages: Array<{role: string, content: string}>, responses: GatewayResponse[]}>} Object containing the model used, conversation messages, and API responses
 * @throws {Error} If any API request fails or returns an error
 *
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/get-started/#make-your-first-gateway-request} Make Your First Gateway Request Documentation
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/} Models and Providers Documentation
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/apis/rest/#operation/chatMessages} REST API Documentation
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/function-calling/} Function Calling Documentation
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/get-started/auth/#api-key-limitations} API Key Limitations Documentation
 */
export const makeGatewayRequests = async (
  apiKey: string,
  utterances: string[],
  model: Model,
  tools: InvocableTool[],
  initialContext?: string[]
): Promise<{ model: Model; messages: Array<{ role: string; content: string }>; responses: GatewayResponse[] }> => {
  const messages: Array<{ role: string; content: string }> = [];
  const responses: GatewayResponse[] = [];

  const allUtterances = initialContext ? [...initialContext, ...utterances] : utterances;

  for (const utterance of allUtterances) {
    // Add the current utterance to messages
    messages.push({
      role: 'user',
      content: utterance,
    });

    // eslint-disable-next-line no-await-in-loop
    const responseData = await makeSingleGatewayRequest(apiKey, model, tools, messages);
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
