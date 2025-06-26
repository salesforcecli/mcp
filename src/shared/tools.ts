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

import { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolInfo } from './types.js';
import Cache from './cache.js';

export const TOOLSETS = ['orgs', 'data', 'users', 'metadata', 'testing', 'experimental'] as const;

type Toolset = (typeof TOOLSETS)[number];

/*
 * These are tools that are always enabled at startup. They cannot be disabled and they cannot be dynamically enabled.
 */
export const CORE_TOOLS = ['sf-get-username', 'sf-resume', 'sf-enable-tool', 'sf-list-all-tools'];

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
      data: false,
      dynamic: true,
      experimental: false,
      metadata: false,
      orgs: false,
      testing: false,
      users: false,
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

/**
 * Add a tool to the cache
 */
export async function addTool(tool: RegisteredTool, name: string): Promise<{ success: boolean; message: string }> {
  const existingTools = await Cache.safeGet('tools');

  // Check if tool already exists
  const existingTool = existingTools.find((t) => t.name === name);
  if (existingTool) {
    return { success: false, message: `Tool ${name} already exists` };
  }

  await Cache.safeUpdate('tools', (toolsArray) => {
    const newTool: ToolInfo = {
      tool,
      name,
    };

    return [...toolsArray, newTool];
  });

  return { success: true, message: `Added tool ${name}` };
}

/**
 * Enable an individual tool
 */
export async function enableTool(toolName: string): Promise<{ success: boolean; message: string }> {
  const tools = await Cache.safeGet('tools');
  const toolInfo = tools.find((t) => t.name === toolName);

  if (!toolInfo) {
    return { success: false, message: `Tool ${toolName} not found` };
  }

  if (toolInfo.tool.enabled) {
    return { success: false, message: `Tool ${toolName} is already enabled` };
  }

  // Enable the tool directly
  toolInfo.tool.enable();

  return { success: true, message: `Tool ${toolName} enabled` };
}

/**
 * Disable an individual tool
 */
export async function disableTool(toolName: string): Promise<{ success: boolean; message: string }> {
  const tools = await Cache.safeGet('tools');
  const toolInfo = tools.find((t) => t.name === toolName);

  if (!toolInfo) {
    return { success: false, message: `Tool ${toolName} not found` };
  }

  if (!toolInfo.tool.enabled) {
    return { success: false, message: `Tool ${toolName} is already disabled` };
  }

  // Disable the tool directly
  toolInfo.tool.disable();

  return { success: true, message: `Tool ${toolName} disabled` };
}

/**
 * Get individual tool status
 */
export async function getToolStatus(toolName: string): Promise<{ enabled: boolean; description: string } | undefined> {
  const tools = await Cache.safeGet('tools');
  const toolInfo = tools.find((t) => t.name === toolName);

  if (!toolInfo) {
    return;
  }

  return {
    enabled: toolInfo.tool.enabled,
    description: toolInfo.tool.description ?? '',
  };
}

/**
 * List all individual tools with their status
 */
export async function listAllTools(): Promise<Array<{ name: string; enabled: boolean; description: string }>> {
  const tools = await Cache.safeGet('tools');

  return tools.map((toolInfo) => ({
    name: toolInfo.name,
    enabled: toolInfo.tool.enabled,
    description: toolInfo.tool.description ?? '',
  }));
}
