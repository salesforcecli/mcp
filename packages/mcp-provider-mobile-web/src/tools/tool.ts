/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import { ZodType } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

export interface Tool {
  /** The display name of the tool */
  readonly name: string;
  /** A description of what the tool does */
  readonly description: string;
  /** Human-readable title for display in client interfaces */
  readonly title: string;
  /** Unique identifier for the tool */
  readonly toolId: string;
  /** Schema defining the input parameters for the tool */
  readonly inputSchema: ZodType<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Schema defining the output format for the tool */
  readonly outputSchema?: ZodType<any>; // eslint-disable-line @typescript-eslint/no-explicit-any

  /** Registers the tool with the MCP server and initializes it with the server and annotations */
  register(server: McpServer, annotations: ToolAnnotations): void;
}
