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

export async function enableTools(tools: string[]): Promise<Array<{ success: boolean; message: string }>> {
  const results: Array<{ success: boolean; message: string }> = [];
  const cachedTools = await Cache.safeGet('tools');

  for (const tool of tools) {
    const toolInfo = cachedTools.find((t) => t.name === tool);
    if (!toolInfo) {
      results.push({ success: false, message: `Tool ${tool} not found` });
      continue;
    }

    if (toolInfo.tool.enabled) {
      results.push({ success: false, message: `Tool ${tool} is already enabled` });
      continue;
    }

    // Enable the tool directly
    toolInfo.tool.enable();

    results.push({ success: true, message: `Tool ${tool} enabled` });
  }

  return results;
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
