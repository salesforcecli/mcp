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

import { McpProvider } from '@salesforce/mcp-provider-api';
import { DxCoreMcpProvider } from '@salesforce/mcp-provider-dx-core';
import { CodeAnalyzerMcpProvider } from '@salesforce/mcp-provider-code-analyzer';
import { LwcExpertsMcpProvider } from '@salesforce/mcp-provider-lwc-experts';
import { AuraExpertsMcpProvider } from '@salesforce/mcp-provider-aura-experts';
import { MobileWebMcpProvider } from '@salesforce/mcp-provider-mobile-web';

/** -------- ADD McpProvider INSTANCES HERE ------------------------------------------------------------------------- */

export const MCP_PROVIDER_REGISTRY: McpProvider[] = [
  new DxCoreMcpProvider(),
  new CodeAnalyzerMcpProvider(),
  new LwcExpertsMcpProvider(),
  new AuraExpertsMcpProvider(),
  new MobileWebMcpProvider(),
  // Add new instances here
];
