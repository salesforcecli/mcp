/*
 * Copyright 2026, Salesforce, Inc.
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
import { MobileWebMcpProvider } from '@salesforce/mcp-provider-mobile-web';
import { DevOpsMcpProvider } from '@salesforce/mcp-provider-devops';
import { ScaleProductsMcpProvider } from '@salesforce/mcp-provider-scale-products';
import { EnrichMetadataMcpProvider } from '@salesforce/mcp-provider-metadata-enrichment';

/**
 * Eager providers are safe to construct when this module loads.
 *
 * LWC/Aura expert providers MUST NOT be imported at module evaluation time:
 * their published bundles wrap `process.stdout.write` with a
 * `[stdout-intercepted]` prefix during import. oclif plugin discovery loads
 * this package for ordinary `sf` commands, which previously corrupted all CLI
 * stdout (forcedotcom/mcp#41). Load those providers only when the MCP server
 * actually registers tools via {@link loadMcpProviders}.
 */
const EAGER_MCP_PROVIDERS: McpProvider[] = [
  new DxCoreMcpProvider(),
  new CodeAnalyzerMcpProvider(),
  new MobileWebMcpProvider(),
  new DevOpsMcpProvider(),
  new ScaleProductsMcpProvider(),
  new EnrichMetadataMcpProvider(),
];

/** Packages that install a stdout interceptor at import time — must stay dynamic. */
export const LAZY_EXPERT_PROVIDER_PACKAGES = [
  '@salesforce/mcp-provider-lwc-experts',
  '@salesforce/mcp-provider-aura-experts',
] as const;

/**
 * Full provider list for MCP server tool registration.
 * Dynamically imports LWC/Aura expert providers so ordinary `sf` plugin load
 * paths that evaluate this module do not activate their stdout interceptors.
 */
export async function loadMcpProviders(): Promise<McpProvider[]> {
  const [{ LwcExpertsMcpProvider }, { AuraExpertsMcpProvider }] = await Promise.all([
    import('@salesforce/mcp-provider-lwc-experts'),
    import('@salesforce/mcp-provider-aura-experts'),
  ]);

  return [
    ...EAGER_MCP_PROVIDERS,
    new LwcExpertsMcpProvider(),
    new AuraExpertsMcpProvider(),
  ];
}
