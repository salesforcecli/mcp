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

const createRequestHeaders = (jwtToken: string): Record<string, string> => ({
  Authorization: `Bearer ${jwtToken}`,
  'Content-Type': 'application/json',
  'x-sfdc-app-context': 'EinsteinGPT',
  'x-client-feature-id': 'ai-platform-models-connected-app',
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

// See https://developer.salesforce.com/docs/einstein/genai/guide/models-api-rate-limits.html
const rateLimiter = new RateLimiter(500, 60_000);

const makeSingleGatewayRequest = async (
  jwtToken: string,
  model: Model,
  tools: InvocableTool[],
  messages: Array<{ role: string; content: string }>
): Promise<GatewayResponse> => {
  const response = await rateLimiter.enqueue(async () =>
    fetch('https://api.salesforce.com/ai/gpt/v1/chat/generations', {
      method: 'POST',
      headers: createRequestHeaders(jwtToken),
      body: createRequestBody(model, tools, messages),
    })
  );

  if (!response.ok) {
    // eslint-disable-next-line no-console
    console.error(`Error making request to LLM Gateway API: ${response.status} ${response.statusText}`);
    // eslint-disable-next-line no-console
    console.error('Response body:', await response.text());
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const responseData = await response.json();
  return responseData as GatewayResponse;
};

/**
 * Makes requests to the LLM Gateway API for multiple utterances using the specified model and tools.
 *
 * @param {string} jwtToken - JWT token for authentication with the Models API
 * @param {string[]} utterances - Array of utterances to send to the API
 * @param {Model} model - The model identifier to use for generation
 * @param {InvocableTool[]} tools - Array of tools that can be invoked by the model
 * @param {string[]} [initialContext] - Optional initial context messages to prepend to the conversation
 * @returns {Promise<{model: Model, messages: Array<{role: string, content: string}>, responses: GatewayResponse[]}>} Object containing the model used, conversation messages, and API responses
 * @throws {Error} If any API request fails or returns an error
 *
 * @see {@link https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/function-calling/} Function Calling Documentation
 */
export const makeGatewayRequests = async (
  jwtToken: string,
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
    const responseData = await makeSingleGatewayRequest(jwtToken, model, tools, messages);
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
