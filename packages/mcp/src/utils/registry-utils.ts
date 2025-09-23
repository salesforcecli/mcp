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
  ReleaseState,
  Toolset,
  TOOLSETS,
  Versioned,
} from '@salesforce/mcp-provider-api';
import { SfMcpServer } from '../sf-mcp-server.js';
import { MCP_PROVIDER_REGISTRY } from '../registry.js';
import { addTool, isToolRegistered } from '../utils/tools.js';
import { Services } from '../services.js';
import { createDynamicServerTools } from '../main-server-provider.js';

export async function registerToolsets(
  toolsets: Array<Toolset | 'all'>,
  tools: string[],
  useDynamicTools: boolean,
  allowNonGaTools: boolean,
  server: SfMcpServer,
  services: Services
): Promise<void> {
  // If no toolsets, tools, or dynamic tools flag was passed, throw an error
  // NOTE: In the future we will also want to check for Personas here
  if (!toolsets.length && !tools.length && !useDynamicTools) {
    throw new Error('Tool registration error. Start server with one of the following flags: --toolsets, --tools, --dynamic-tools')
  }

  if (useDynamicTools) {
    // If --dynamic-tools flag was passed, register the tools needed to handle dynamic tool registration
    const dynamicTools = createDynamicServerTools(server);

    // This should always be true because using `--dynamic-tools` and `--toolsets` is blocked.
    // If that doesn't change after GA, this can be just `toolsets.push('all')`
    const isAllToolsetEnabled = toolsets.includes('all')
    if (!isAllToolsetEnabled) toolsets.push('all')

    ux.stderr('Registering dynamic tools.');
    // eslint-disable-next-line no-await-in-loop
    await registerTools(dynamicTools, server, useDynamicTools, allowNonGaTools);
  } else {
    ux.stderr('Skipping registration of dynamic tools.');
  }

  const toolsetsToEnable: Set<Toolset> = toolsets.includes('all')
    ? new Set(TOOLSETS)
    // CORE toolset is always enabled
    : new Set([Toolset.CORE, ...(toolsets as Toolset[])]);

  const toolsetRegistry: Record<Toolset, McpTool[]> = await createToolRegistryFromProviders(
    MCP_PROVIDER_REGISTRY,
    services
  );

  ux.stderr('REGISTERING TOOLSETS (--toolsets)');
  for (const toolset of TOOLSETS) {
    if (toolsetsToEnable.has(toolset)) {
      ux.stderr(`Registering toolset: '${toolset}'`);
      // eslint-disable-next-line no-await-in-loop
      await registerTools(toolsetRegistry[toolset], server, useDynamicTools, allowNonGaTools);
    } else {
      ux.stderr(`   Skipping toolset: '${toolset}'`);
    }
  }

  if (tools.length > 0) {
    ux.stderr('REGISTERING TOOLS (--tools)');
    // Build an array of available McpTools
    const toolRegistry = Object.values(toolsetRegistry).flat();

    // NOTE: This validation could be removed it we implemented Flags.option
    const existingToolNames = new Set(toolRegistry.map(tool => tool.getName()));
    // Validate that all requested tools exist
    const invalidTools = tools.filter(toolName => !existingToolNames.has(toolName));
    if (invalidTools.length > 0) throw new Error(`Invalid tool names provided to --tools: ${invalidTools.join(', ')}`);

    for (const tool of toolRegistry) {
      if (tools.includes(tool.getName())) {
        // eslint-disable-next-line no-await-in-loop
        await registerTools([tool], server, useDynamicTools, allowNonGaTools);
      }
    }
  }
}

async function registerTools(
  tools: McpTool[],
  server: SfMcpServer,
  useDynamicTools: boolean,
  allowNonGaTools: boolean
): Promise<void> {
  for (const tool of tools) {
    if (!allowNonGaTools && tool.getReleaseState() === ReleaseState.NON_GA) {
      ux.stderr(
        `* Skipping registration of non-ga tool '${tool.getName()}' because the '--allow-non-ga-tools' flag was not set at server startup.`
      );
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    if (await isToolRegistered(tool.getName())) {
      ux.stderr(`* Skipping registration of tool '${tool.getName()}' because it is already registered.`);
      continue;
    }
    const registeredTool = server.registerTool(tool.getName(), tool.getConfig(), (...args) => tool.exec(...args));
    const toolsets = tool.getToolsets();
    if (useDynamicTools && !toolsets.includes(Toolset.CORE)) {
      ux.stderr(
        `* Registering tool '${tool.getName()}' but marking it as disabled for now because the server is set for dynamic tool loading.`
      );
      registeredTool.disable();
    } else {
      ux.stderr(`   Tool registered: '${tool.getName()}'`);
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
