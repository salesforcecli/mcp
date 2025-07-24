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

// See https://git.soma.salesforce.com/pages/tech-enablement/einstein/docs/gateway/models-and-providers/
export const MODELS = [
  'llmgateway__OpenAIGPT35Turbo_01_25',
  'llmgateway__OpenAIGPT4OmniMini',
  'llmgateway__BedrockAnthropicClaude4Sonnet',
  'llmgateway__OpenAIGPT41Nano',
  'llmgateway__OpenAIGPT41Mini',
  'llmgateway__BedrockAnthropicClaude37Sonnet',
  'llmgateway__BedrockAnthropicClaude3Opus',
  'llmgateway__VertexAIGemini25Flash001',
] as const;

export type Model = (typeof MODELS)[number];
export const DEFAULT_MODEL: Model = 'llmgateway__BedrockAnthropicClaude4Sonnet';
