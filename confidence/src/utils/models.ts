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

// https://developer.salesforce.com/docs/einstein/genai/guide/supported-models.html
export const MODELS = [
  'sfdc_ai__DefaultBedrockAnthropicClaude37Sonnet',
  'sfdc_ai__DefaultOpenAIGPT35Turbo',
  'sfdc_ai__DefaultGPT41Mini',
  'sfdc_ai__DefaultBedrockAnthropicClaude4Sonnet',
  'sfdc_ai__DefaultOpenAIGPT4OmniMini',
  'sfdc_ai__DefaultVertexAIGeminiPro25',
] as const;

export type Model = (typeof MODELS)[number];
