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
import { McpProvider, McpTool, McpToolConfig, Services, TelemetryEvent, TelemetryService, Toolset } from '@salesforce/mcp-provider-api';
import * as platformCli from './modules/platform-cli/index.js';
import { SfMcpServer } from './sf-mcp-server.js';

/**
 * All teams should instantiate their McpProvider instance here:
 */

const MCP_PROVIDER_REGISTRY: McpProvider[] = [
  new platformCli.PlatformCliMcpProvider(),
  // Add new instances here
]



/** ----------------- ONLY THE CLI TEAM SHOULD MODIFY THE CODE BELOW THIS LINE -------------------------------------- */

export const TOOLSETS: Toolset[] = Object.values(Toolset);

/*
 * These are tools that are always enabled at startup. They cannot be disabled and they cannot be dynamically enabled.
 *
 * If you are added a new core tool, please add it to this list so that the SfMcpServer knows about it.
 */
export const CORE_TOOLS = [
  'sf-get-username',
  'sf-resume',
  'sf-enable-tools',
  'sf-list-tools',
  'sf-suggest-cli-command',
];

// These 'dynamic' tools are special and are tied to the server
const oldDynamicTools: Array<(server: SfMcpServer) => void> = [platformCli.enableTools, platformCli.listTools];

/**
 * The tool registry maps toolsets to functions that register tools with the server.
 *
 * When adding a new tool, you must add it to the appropriate toolset in this registry.
 */
const OLD_TOOL_REGISTRY: Record<Toolset, Array<(server: SfMcpServer) => void>> = {
  // Note that 'core' tools are always enabled
  [Toolset.CORE]: [
    platformCli.getUsername,
    platformCli.resume,
    platformCli.suggestCliCommand
  ],
  
  [Toolset.ORGS]: [
    platformCli.listAllOrgs
  ],
  [Toolset.DATA]: [
    platformCli.queryOrg
  ],
  [Toolset.USERS]: [
  ],
  [Toolset.TESTING]: [
    platformCli.testAgent,
    platformCli.testApex
  ],
  [Toolset.METADATA]: [
    platformCli.deployMetadata,
    platformCli.retrieveMetadata
  ],
  [Toolset.EXPERIMENTAL]: [
    platformCli.orgOpen,
    platformCli.createScratchOrg,
    platformCli.deleteOrg,
    platformCli.createOrgSnapshot,
  ],
};

export function registerToolsets(toolsets: Array<Toolset | 'all'>, useDynamicTools: boolean, server: SfMcpServer): void {
  if (useDynamicTools) {
    ux.stderr('Registering dynamic tools');
    registerTools_old(oldDynamicTools, server); // TODO: rework this to use the new registerTools
  } else {
    ux.stderr('Skipping registration of dynamic tools');
  }
  
  const toolsetsToEnable: Set<Toolset> = toolsets.includes('all') ? 
    new Set(TOOLSETS.filter(ts => ts !== Toolset.EXPERIMENTAL)) :
    new Set([Toolset.CORE, ...(toolsets as Toolset[])]);

  // TODO: This is temporary... we should implement this soon and ideally
  // it should be passed in.
  const services: Services = new NoOpServices();

  const newToolRegistry: Record<Toolset, McpTool[]> = createToolRegistryFromProviders(MCP_PROVIDER_REGISTRY, services);

  for (const toolset of TOOLSETS) {
    if (toolsetsToEnable.has(toolset)) {
      ux.stderr(`Registering ${toolset} tools`);
      registerTools_old(OLD_TOOL_REGISTRY[toolset], server); // TODO: Eventually we should get rid of this
      registerTools(newToolRegistry[toolset], server);
    } else {
      ux.stderr(`Skipping registration of ${toolset} tools`);
    }
  }
}

function registerTools_old(tools: Array<(server: SfMcpServer) => void>, server: SfMcpServer): void {
  for (const registerToolFcn of tools) {
    registerToolFcn(server);
  }
}

function registerTools(tools: McpTool[], server: SfMcpServer): void {
  for (const tool of tools) {
    // TODO: registerTool isn't overridden by the SfMcpServer yet, so we reroute everything through the server.tool for now.
    // in the future this could look like: server.registerTool(tool.getName(), tool.getConfig(), tool.exec);
    const toolConfig: McpToolConfig = tool.getConfig();
    server.tool(tool.getName(), toolConfig.description ?? '', toolConfig.inputSchema ?? {},
      {title: toolConfig.title, ...toolConfig.annotations}, tool.exec);
  }
}

function createToolRegistryFromProviders(providers: McpProvider[], services: Services): Record<Toolset, McpTool[]> {
  // Initialize an empty registry
  const registry: Record<Toolset, McpTool[]> = Object.fromEntries(Object.values(Toolset)
    .map(key => [key, [] as McpTool[]])) as Record<Toolset, McpTool[]>;

  // Fill in the registry
  for (const provider of providers) {
    for (const tool of provider.provideTools(services)) {
      for (const toolset of tool.getToolsets()) {
        registry[toolset].push(tool);
      }
    }
  }
  return registry;
}

class NoOpServices implements Services {
  public getTelemetryService(): TelemetryService {
    return new NoOpTelemetryService();
  }
}

class NoOpTelemetryService implements TelemetryService {
  public sendTelemetryEvent(_eventName: string, _event: TelemetryEvent): void {
    // no-op
  }
}