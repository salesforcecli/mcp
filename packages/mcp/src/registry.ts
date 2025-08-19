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
import * as platformCli from './modules/platform-cli/index.js';
import { SfMcpServer } from './sf-mcp-server.js';

export const TOOLSETS = ['orgs', 'data', 'users', 'metadata', 'testing', 'experimental'] as const;

type Toolset = (typeof TOOLSETS)[number];

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

/**
 * The tool registry maps toolsets to functions that register tools with the server.
 *
 * When adding a new tool, you must add it to the appropriate toolset in this registry.
 */
const TOOL_REGISTRY: Record<Toolset | 'core' | 'dynamic', Array<(server: SfMcpServer) => void>> = {
  core: [platformCli.getUsername, platformCli.resume, platformCli.suggestCliCommand],
  dynamic: [platformCli.enableTools, platformCli.listTools],
  orgs: [platformCli.listAllOrgs],
  data: [platformCli.queryOrg],
  users: [platformCli.assignPermissionSet],
  testing: [platformCli.testAgent, platformCli.testApex],
  metadata: [platformCli.deployMetadata, platformCli.retrieveMetadata],
  experimental: [
    platformCli.orgOpen,
    platformCli.createScratchOrg,
    platformCli.deleteOrg,
    platformCli.createOrgSnapshot,
  ],
};

/**
 * Determines which toolsets should be enabled based on the provided toolsets array and dynamic tools flag.
 *
 * @param {Array<Toolset | 'all'>} toolsets - Array of toolsets to enable. Can include 'all' to enable all non-experimental toolsets.
 * @param {boolean} dynamicTools - Flag indicating whether dynamic tools should be enabled. When true, only core and dynamic toolsets are enabled.
 * @returns {Record<Toolset | 'dynamic' | 'core', boolean>} Object mapping each toolset to a boolean indicating whether it should be enabled.
 *
 * @example
 * // Enable all toolsets except experimental
 * determineToolsetsToEnable(['all'], false)
 * // Returns: { core: true, data: true, dynamic: false, experimental: false, metadata: true, orgs: true, testing: true, users: true }
 *
 * @example
 * // Enable only dynamic tools
 * determineToolsetsToEnable([], true)
 * // Returns: { core: true, data: false, dynamic: true, experimental: false, metadata: false, orgs: false, testing: false, users: false }
 *
 * @example
 * // Enable specific toolsets
 * determineToolsetsToEnable(['data', 'users'], false)
 * // Returns: { core: true, data: true, dynamic: false, experimental: false, metadata: false, orgs: false, testing: false, users: true }
 */
export function determineToolsetsToEnable(
  toolsets: Array<Toolset | 'all'>,
  dynamicTools: boolean
): Record<Toolset | 'dynamic' | 'core', boolean> {
  if (dynamicTools) {
    return {
      core: true,
      data: true,
      dynamic: true,
      experimental: false,
      metadata: true,
      orgs: true,
      testing: true,
      users: true,
    };
  }

  if (toolsets.includes('all')) {
    return {
      core: true,
      data: true,
      dynamic: false,
      experimental: false,
      metadata: true,
      orgs: true,
      testing: true,
      users: true,
    };
  }

  return {
    core: true,
    data: toolsets.includes('data'),
    dynamic: false,
    experimental: toolsets.includes('experimental'),
    metadata: toolsets.includes('metadata'),
    orgs: toolsets.includes('orgs'),
    testing: toolsets.includes('testing'),
    users: toolsets.includes('users'),
  };
}

function registerToolset(toolset: Toolset | 'core' | 'dynamic', server: SfMcpServer): void {
  if (TOOL_REGISTRY[toolset]) {
    for (const tool of TOOL_REGISTRY[toolset]) {
      tool(server);
    }
  } else {
    throw new Error(`Failed to register toolset ${toolset}.`);
  }
}

export function registerToolsets(toolsets: Array<Toolset | 'all'>, dynamicTools: boolean, server: SfMcpServer): void {
  const toolsetsToEnable = determineToolsetsToEnable(toolsets, dynamicTools);

  for (const toolset of ['core', 'dynamic', ...TOOLSETS] as Toolset[]) {
    if (!toolsetsToEnable[toolset]) {
      ux.stderr(`Skipping registration of ${toolset} tools`);
      continue;
    }

    ux.stderr(`Registering ${toolset} tools`);
    registerToolset(toolset, server);
  }
}
