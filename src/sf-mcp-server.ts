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

import { McpServer, RegisteredTool, ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  CallToolResult,
  Implementation,
  ServerNotification,
  ServerRequest,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { Logger } from '@salesforce/core';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Telemetry } from './telemetry.js';

type ToolMethodSignatures = {
  tool: McpServer['tool'];
  connect: McpServer['connect'];
};

const EMPTY_OBJECT_JSON_SCHEMA = {
  type: 'object' as const,
};

function countTokens(tool: Tool): number {
  let totalTokens = 0;

  // Count tokens in tool name
  totalTokens += tool.name.length;

  // Count tokens in description
  if (tool.description) {
    totalTokens += tool.description.length;
  }

  // Count tokens in input schema
  if (tool.inputSchema) {
    totalTokens += JSON.stringify(tool.inputSchema).length;
  }

  // Count tokens in output schema
  if (tool.outputSchema) {
    totalTokens += JSON.stringify(tool.outputSchema).length;
  }

  // Count tokens in annotations
  if (tool.annotations) {
    totalTokens += JSON.stringify(tool.annotations).length;
  }

  return totalTokens;
}

/**
 * A server implementation that extends the base MCP server with telemetry capabilities.
 *
 * The method overloads for `tool` are taken directly from the source code for the original McpServer. They're
 * copied here so that the types don't get lost.
 *
 * @extends {McpServer}
 */
export class SfMcpServer extends McpServer implements ToolMethodSignatures {
  private logger = Logger.childFromRoot('mcp-server');
  private tokenCounts: Record<string, number> = {};

  /** Optional telemetry instance for tracking server events */
  private telemetry?: Telemetry;

  /**
   * Creates a new SfMcpServer instance
   *
   * @param {Implementation} serverInfo - The server implementation details
   * @param {ServerOptions & { telemetry?: Telemetry }} [options] - Optional server configuration including telemetry
   */
  public constructor(serverInfo: Implementation, options?: ServerOptions & { telemetry?: Telemetry }) {
    super(serverInfo, options);
    this.telemetry = options?.telemetry;
    this.server.oninitialized = (): void => {
      const clientInfo = this.server.getClientVersion();
      if (clientInfo) {
        this.telemetry?.addAttributes({
          clientName: clientInfo.name,
          clientVersion: clientInfo.version,
        });
      }
      this.telemetry?.sendEvent('SERVER_START_SUCCESS');

      this.logger.debug(
        `Total tokens: ${Object.values(this.tokenCounts)
          .reduce((acc, count) => acc + count, 0)
          .toString()}`
      );

      for (const [name, count] of Object.entries(this.tokenCounts)) {
        this.logger.debug(`${name}: ${count}`);
      }
    };
  }

  public connect: McpServer['connect'] = async (transport: Transport): Promise<void> => {
    try {
      await super.connect(transport);
      if (!this.isConnected()) {
        this.telemetry?.sendEvent('SERVER_START_ERROR', {
          error: 'Server not connected',
        });
      }
    } catch (error: unknown) {
      this.telemetry?.sendEvent('SERVER_START_ERROR', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  };

  public tool: McpServer['tool'] = (name: string, ...rest: unknown[]): RegisteredTool => {
    // Given the signature of the tool function, the last argument is always the callback
    const cb = rest[rest.length - 1] as ToolCallback;

    const wrappedCb = async (args: RequestHandlerExtra<ServerRequest, ServerNotification>): Promise<CallToolResult> => {
      this.logger.debug(`Tool ${name} called`);
      const startTime = Date.now();
      const result = await cb(args);
      const runtimeMs = Date.now() - startTime;

      this.logger.debug(`Tool ${name} completed in ${runtimeMs}ms`);
      if (result.isError) this.logger.debug(`Tool ${name} errored`);

      this.telemetry?.sendEvent('TOOL_CALLED', {
        name,
        runtimeMs,
        isError: result.isError,
      });

      return result;
    };

    // @ts-expect-error because we no longer know what the type of rest is
    const tool = super.tool(name, ...rest.slice(0, -1), wrappedCb);

    // Count the number to tokens for the tool definition
    // Implementation copied from the typescript sdk:
    // https://github.com/modelcontextprotocol/typescript-sdk/blob/dd69efa1de8646bb6b195ff8d5f52e13739f4550/src/server/mcp.ts#L110
    const toolDefinition: Tool = {
      name,
      description: tool.description,
      inputSchema: tool.inputSchema
        ? (zodToJsonSchema(tool.inputSchema, {
            strictUnions: true,
          }) as Tool['inputSchema'])
        : EMPTY_OBJECT_JSON_SCHEMA,
      annotations: tool.annotations,
    };

    if (tool.outputSchema) {
      toolDefinition.outputSchema = zodToJsonSchema(tool.outputSchema, {
        strictUnions: true,
      }) as Tool['outputSchema'];
    }

    this.tokenCounts[name] = countTokens(toolDefinition);

    return tool;
  };
}
