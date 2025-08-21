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

import { ux } from '@oclif/core';
import {
  MCP_PROVIDER_API_VERSION,
  McpProvider,
  McpTool,
  Toolset,
  TOOLSETS,
  Versioned,
} from '@salesforce/mcp-provider-api';
import { SfMcpServer } from './sf-mcp-server.js';
import { MCP_PROVIDER_REGISTRY } from './registry.js';
import { addTool } from './shared/tools.js';
import { Services } from './services.js';

export async function registerToolsets(
  toolsets: Array<Toolset | 'all'>,
  useDynamicTools: boolean,
  server: SfMcpServer,
  services: Services
): Promise<void> {
  // If dynamic tools are being used -> only enable core and dynamic
  // If 'all' is specified, enable all non-experimental and non-dynamic toolsets
  // Otherwise, enable the specified toolsets and the core toolset
  const toolsetsToEnable: Set<Toolset> = useDynamicTools
    ? new Set([Toolset.CORE, Toolset.DYNAMIC])
    : toolsets.includes('all')
    ? new Set(TOOLSETS.filter((ts) => ts !== Toolset.EXPERIMENTAL && ts !== Toolset.DYNAMIC))
    : new Set([Toolset.CORE, ...(toolsets as Toolset[])]);

  const newToolRegistry: Record<Toolset, McpTool[]> = await createToolRegistryFromProviders(
    MCP_PROVIDER_REGISTRY,
    services
  );

  for (const toolset of TOOLSETS) {
    if (toolsetsToEnable.has(toolset)) {
      ux.stderr(`Registering ${toolset} tools`);
      // eslint-disable-next-line no-await-in-loop
      await registerTools(newToolRegistry[toolset], server, useDynamicTools);
    } else {
      ux.stderr(`Skipping registration of ${toolset} tools`);
    }
  }
}

async function registerTools(tools: McpTool[], server: SfMcpServer, useDynamicTools: boolean): Promise<void> {
  for (const tool of tools) {
    const registeredTool = server.registerTool(tool.getName(), tool.getConfig(), (...args) => tool.exec(...args));
    const toolsets = tool.getToolsets();
    if (useDynamicTools && !toolsets.includes(Toolset.CORE) && !toolsets.includes(Toolset.DYNAMIC)) {
      registeredTool.disable();
    }
    // eslint-disable-next-line no-await-in-loop
    await addTool(registeredTool, tool.getName());
  }
}

async function createToolRegistryFromProviders(
  providers: McpProvider[],
  services: Services
): Promise<Record<Toolset, McpTool[]>> {
  // Initialize an empty registry
  const registry: Record<Toolset, McpTool[]> = Object.fromEntries(
    Object.values(Toolset).map((key) => [key, [] as McpTool[]])
  ) as Record<Toolset, McpTool[]>;

  // Avoid calling await in a loop by first getting all the promises
  const toolPromises: Array<Promise<McpTool[]>> = [];
  for (const provider of providers) {
    validateMcpProviderVersion(provider);
    const toolsPromise: Promise<McpTool[]> = provider.provideTools(services);
    toolPromises.push(toolsPromise);
  }

  // Get all the tools from the promises and then add them to the registry
  const tools: McpTool[] = (await Promise.all(toolPromises)).flat();
  for (const tool of tools) {
    for (const toolset of tool.getToolsets()) {
      registry[toolset].push(tool);
    }
  }
  return registry;
}

/**
 * Validation function to confirm that providers are at the expected major version.
 */
function validateMcpProviderVersion(provider: Versioned): void {
  if (provider.getVersion().major !== MCP_PROVIDER_API_VERSION.major) {
    throw new Error(
      `The version '${provider
        .getVersion()
        .toString()}' for '${provider.getName()}' is incompatible with this MCP Server.\n` +
        `Expected the major version to be '${MCP_PROVIDER_API_VERSION.major}'.`
    );
  }
}
