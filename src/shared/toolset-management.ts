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
import { Toolset } from './types.js';
import { TOOLSET_REGISTRY } from './toolset-registry.js';
import Cache from './cache.js';

/**
 * Find the toolset name that contains a specific tool
 *
 * @param tool - The name of the tool to search for
 * @returns The name of the toolset containing the tool, or undefined if not found
 */
export function getToolsetNameFromTool(tool: string): string | undefined {
  return Object.keys(TOOLSET_REGISTRY).find((key) =>
    TOOLSET_REGISTRY[key as keyof typeof TOOLSET_REGISTRY].includes(tool)
  );
}

/**
 * Validate if a toolset name exists in the registry
 */
export function isValidToolset(toolsetName: string): boolean {
  return Object.keys(TOOLSET_REGISTRY).includes(toolsetName);
}

/**
 * Get all available toolset names from the registry
 */
export function getAvailableToolsets(): string[] {
  return Object.keys(TOOLSET_REGISTRY);
}

/**
 * Get tools for a specific toolset from the registry
 */
export function getToolsForToolset(toolsetName: string): string[] {
  return TOOLSET_REGISTRY[toolsetName as keyof typeof TOOLSET_REGISTRY] || [];
}

/**
 * Enable a toolset using thread-safe cache operations
 */
export async function enableToolset(toolsetName: string): Promise<{ success: boolean; message: string }> {
  const updatedMap = await Cache.safeUpdate('toolsets', (toolsetsMap) => {
    const toolset = toolsetsMap.get(toolsetName);

    if (!toolset) {
      return toolsetsMap; // No change, return original map
    }

    if (toolset.enabled) {
      return toolsetsMap; // No change, return original map
    }

    // Create updated toolset
    const updatedToolset: Toolset = {
      enabled: true,
      tools: [...toolset.tools], // Shallow copy the tools array
    };

    // Enable all tools
    for (const { tool } of updatedToolset.tools) {
      tool.enable();
    }

    // Create new map with updated toolset
    const newMap = new Map(toolsetsMap);
    newMap.set(toolsetName, updatedToolset);
    return newMap;
  });

  const toolset = updatedMap.get(toolsetName);
  if (!toolset) {
    return { success: false, message: `Toolset ${toolsetName} not found` };
  }
  if (!toolset.enabled) {
    return { success: false, message: `Toolset ${toolsetName} is already enabled` };
  }
  return { success: true, message: `Toolset ${toolsetName} enabled` };
}

/**
 * Disable a toolset using thread-safe cache operations
 */
export async function disableToolset(toolsetName: string): Promise<{ success: boolean; message: string }> {
  const updatedMap = await Cache.safeUpdate('toolsets', (toolsetsMap) => {
    const toolset = toolsetsMap.get(toolsetName);

    if (!toolset) {
      return toolsetsMap; // No change, return original map
    }

    if (!toolset.enabled) {
      return toolsetsMap; // No change, return original map
    }

    // Create updated toolset
    const updatedToolset: Toolset = {
      enabled: false,
      tools: [...toolset.tools], // Shallow copy the tools array
    };

    // Disable all tools
    for (const { tool } of updatedToolset.tools) {
      tool.disable();
    }

    // Create new map with updated toolset
    const newMap = new Map(toolsetsMap);
    newMap.set(toolsetName, updatedToolset);
    return newMap;
  });

  const toolset = updatedMap.get(toolsetName);
  if (!toolset) {
    return { success: false, message: `Toolset ${toolsetName} not found` };
  }
  if (toolset.enabled) {
    return { success: false, message: `Toolset ${toolsetName} is already disabled` };
  }
  return { success: true, message: `Toolset ${toolsetName} disabled` };
}

/**
 * Add tool to toolset using thread-safe cache operations
 */
export async function addToolToToolset(
  toolsetName: string,
  tool: RegisteredTool,
  name: string
): Promise<{ success: boolean; message: string }> {
  const originalMap = await Cache.safeGet('toolsets');
  const wasCreated = !originalMap.has(toolsetName);

  const updatedMap = await Cache.safeUpdate('toolsets', (toolsetsMap) => {
    const toolset = toolsetsMap.get(toolsetName);
    const newMap = new Map(toolsetsMap);

    if (!toolset) {
      // Create new toolset if it doesn't exist
      const newToolset: Toolset = {
        enabled: false,
        tools: [{ tool, name }],
      };
      newMap.set(toolsetName, newToolset);
      return newMap;
    }

    // Check if tool already exists
    const existingTool = toolset.tools.find((t) => t.name === name);
    if (existingTool) {
      return toolsetsMap; // No change, return original map
    }

    // Create updated toolset with new tool
    const updatedToolset: Toolset = {
      enabled: toolset.enabled,
      tools: [...toolset.tools, { tool, name }],
    };

    newMap.set(toolsetName, updatedToolset);
    return newMap;
  });

  const toolset = updatedMap.get(toolsetName);

  if (!toolset) {
    return { success: false, message: `Failed to create toolset ${toolsetName}` };
  }

  const toolExists = toolset.tools.some((t) => t.name === name);
  if (!toolExists) {
    return { success: false, message: `Tool ${name} already exists in toolset ${toolsetName}` };
  }

  if (wasCreated) {
    return { success: true, message: `Created toolset ${toolsetName} and added tool ${name}` };
  }
  return { success: true, message: `Added tool ${name} to toolset ${toolsetName}` };
}

/**
 * Get toolset status using thread-safe cache operations
 */
export async function getToolsetStatus(toolsetName: string): Promise<Toolset | undefined> {
  const toolsetsMap = await Cache.safeGet('toolsets');
  const toolset = toolsetsMap.get(toolsetName);

  // Return a deep copy to prevent external mutations
  if (toolset) {
    return {
      enabled: toolset.enabled,
      tools: toolset.tools.map((t) => ({ ...t })),
    };
  }

  return undefined;
}

/**
 * List all toolsets using thread-safe cache operations
 */
export async function listAllToolsets(): Promise<Array<{ name: string; enabled: boolean; toolCount: number }>> {
  const toolsetsMap = await Cache.safeGet('toolsets');
  const result: Array<{ name: string; enabled: boolean; toolCount: number }> = [];

  for (const [name, toolset] of toolsetsMap.entries()) {
    result.push({
      name,
      enabled: toolset.enabled,
      toolCount: toolset.tools.length,
    });
  }

  return result;
}
