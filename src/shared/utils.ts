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

/* eslint-disable no-console */

import path from 'node:path';
import { type ToolTextResponse } from './types.js';

// TODO: break into two helpers? One for errors and one for success?
export function textResponse(text: string, isError: boolean = false): ToolTextResponse {
  if (text === '') throw new Error('textResponse error: "text" cannot be empty');
  return {
    isError,
    content: [
      {
        type: 'text',
        text,
      },
    ],
  };
}

/**
 * Gets the enabled toolsets based on user input and validates against available toolsets
 *
 * @param availableToolsets - The list of available toolsets
 * @param toolsetsInput - The comma-separated list of toolsets
 * @returns A Set of enabled toolsets
 */
export function getEnabledToolsets(availableToolsets: string[], toolsetsInput: string): Set<string> {
  const availableToolsetsSet = new Set<string>(availableToolsets);
  const passedToolsets = toolsetsInput.split(',').map((toolset) => toolset.trim());

  // Check if any passed toolset is not in the available list
  for (const toolset of passedToolsets) {
    if (!availableToolsetsSet.has(toolset)) {
      console.error(
        `Passed toolset "${toolset}" is not in the allowed toolset list. Available toolsets are "all (default), ${Array.from(
          availableToolsetsSet
        )
          .filter((t) => t !== 'all')
          .join(', ')}"`
      );
      process.exit(1);
    }
  }

  const enabledToolsets = new Set<string>(passedToolsets.filter((toolset) => availableToolsetsSet.has(toolset)));
  console.error('Enabling toolsets:', Array.from(enabledToolsets).join(', '));

  return enabledToolsets;
}

export function sanitizePath(projectPath: string): boolean {
  // Decode URL-encoded sequences
  const decodedProjectPath = decodeURIComponent(projectPath);
  // Normalize Unicode characters
  const normalizedProjectPath = decodedProjectPath.normalize();

  // Check for various traversal patterns
  const hasTraversal =
    normalizedProjectPath.includes('..') ||
    normalizedProjectPath.includes('\u2025') || // Unicode horizontal ellipsis
    normalizedProjectPath.includes('\u2026'); // Unicode vertical ellipsis

  // `path.isAbsolute` doesn't cover Windows's drive-relative path:
  // https://github.com/nodejs/node/issues/56766
  //
  // we can assume it's a drive-relative path if it's starts with `\`.
  const isAbsolute =
    path.isAbsolute(projectPath) && (process.platform === 'win32' ? !projectPath.startsWith('\\') : true);

  return !hasTraversal && isAbsolute;
}
