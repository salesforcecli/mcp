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
import { Toolset } from '@salesforce/mcp-provider-api';
import * as platformCli from './modules/platform-cli/index.js';
import { SfMcpServer } from './sf-mcp-server.js';

export const TOOLSETS: Toolset[] = Object.values(Toolset)

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
const dynamicTools: Array<(server: SfMcpServer) => void> = [platformCli.enableTools, platformCli.listTools];

/**
 * The tool registry maps toolsets to functions that register tools with the server.
 *
 * When adding a new tool, you must add it to the appropriate toolset in this registry.
 */
const TOOL_REGISTRY: Record<Toolset, Array<(server: SfMcpServer) => void>> = {

  // Note that 'core' tools are always enabled
  core: [
    platformCli.getUsername,
    platformCli.resume,
    platformCli.suggestCliCommand
  ],
  
  orgs: [
    platformCli.listAllOrgs
  ],
  data: [
    platformCli.queryOrg
  ],
  users: [
    platformCli.assignPermissionSet
  ],
  testing: [
    platformCli.testAgent,
    platformCli.testApex
  ],
  metadata: [
    platformCli.deployMetadata,
    platformCli.retrieveMetadata
  ],
  experimental: [
    platformCli.orgOpen,
    platformCli.createScratchOrg,
    platformCli.deleteOrg,
    platformCli.createOrgSnapshot,
  ],
};

export function registerToolsets(toolsets: Array<Toolset | 'all'>, useDynamicTools: boolean, server: SfMcpServer): void {
  if (useDynamicTools) {
    ux.stderr('Registering dynamic tools');
    registerTools(dynamicTools, server);
  } else {
    ux.stderr('Skipping registration of dynamic tools');
  }
  
  const toolsetsToEnable: Set<Toolset> = toolsets.includes('all') ? 
    new Set(TOOLSETS.filter(ts => ts !== Toolset.EXPERIMENTAL)) :
    new Set([Toolset.CORE, ...(toolsets as Toolset[])]);

  for (const toolset of TOOLSETS) {
    if (toolsetsToEnable.has(toolset)) {
      ux.stderr(`Registering ${toolset} tools`);
      registerTools(TOOL_REGISTRY[toolset], server);
    } else {
      ux.stderr(`Skipping registration of ${toolset} tools`);
    }
  }
}

function registerTools(tools: Array<(server: SfMcpServer) => void>, server: SfMcpServer): void {
    for (const registerToolFcn of tools) {
      registerToolFcn(server);
    }
}