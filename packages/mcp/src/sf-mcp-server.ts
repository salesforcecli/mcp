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
  ToolAnnotations,
} from '@modelcontextprotocol/sdk/types.js';
import { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { Logger } from '@salesforce/core';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { ZodRawShape } from 'zod';
import { Telemetry } from './telemetry.js';
import { RateLimiter, RateLimitConfig, createRateLimiter } from './shared/rate-limiter.js';

type ToolMethodSignatures = {
  tool: McpServer['tool'];
  connect: McpServer['connect'];
  registerTool: McpServer['registerTool'];
};

/**
 * Extended server options that include telemetry and rate limiting
 */
export type SfMcpServerOptions = ServerOptions & {
  /** Optional telemetry instance for tracking server events */
  telemetry?: Telemetry;
  /** Optional rate limiting configuration */
  rateLimit?: Partial<RateLimitConfig>;
  /** Enable dynamic tool loading */
  dynamicTools?: boolean;
};

/**
 * A server implementation that extends the base MCP server with telemetry and rate limiting capabilities.
 *
 * The method overloads for `tool` are taken directly from the source code for the original McpServer. They're
 * copied here so that the types don't get lost.
 *
 * @extends {McpServer}
 */
export class SfMcpServer extends McpServer implements ToolMethodSignatures {
  private logger = Logger.childFromRoot('mcp-server');

  /** Optional telemetry instance for tracking server events */
  private telemetry?: Telemetry;

  /** Rate limiter for controlling tool call frequency */
  private rateLimiter?: RateLimiter;

  /**
   * Creates a new SfMcpServer instance
   *
   * @param {Implementation} serverInfo - The server implementation details
   * @param {SfMcpServerOptions} [options] - Optional server configuration including telemetry and rate limiting
   */
  public constructor(serverInfo: Implementation, options?: SfMcpServerOptions) {
    super(serverInfo, options);
    this.telemetry = options?.telemetry;
    // Initialize rate limiter if configuration is provided
    if (options?.rateLimit !== undefined) {
      this.rateLimiter = createRateLimiter(options.rateLimit);
      this.logger.debug('Rate limiter initialized', options.rateLimit);
    }
    this.server.oninitialized = (): void => {
      const clientInfo = this.server.getClientVersion();
      if (clientInfo) {
        this.telemetry?.addAttributes({
          clientName: clientInfo.name,
          clientVersion: clientInfo.version,
        });
      }
      this.telemetry?.sendEvent('SERVER_START_SUCCESS');
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

  public registerTool<InputArgs extends ZodRawShape, OutputArgs extends ZodRawShape>(
    name: string,
    config: {
      title?: string;
      description?: string;
      inputSchema?: InputArgs;
      outputSchema?: OutputArgs;
      annotations?: ToolAnnotations;
    },
    cb: ToolCallback<InputArgs>
  ): RegisteredTool {
    const wrappedCb = async (
      args: InputArgs,
      extra: RequestHandlerExtra<ServerRequest, ServerNotification>
    ): Promise<CallToolResult> => {
      this.logger.debug(`Tool ${name} called`);

      // Check rate limit before executing tool
      if (this.rateLimiter) {
        const rateLimitResult = this.rateLimiter.checkLimit();

        if (!rateLimitResult.allowed) {
          this.logger.warn(`Tool ${name} rate limited. Retry after: ${rateLimitResult.retryAfter ?? 0}ms`);

          this.telemetry?.sendEvent('TOOL_RATE_LIMITED', {
            name,
            retryAfter: rateLimitResult.retryAfter,
            remaining: rateLimitResult.remaining,
          });

          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Rate limit exceeded. Too many tool calls. Please wait ${Math.ceil(
                  (rateLimitResult.retryAfter ?? 0) / 1000
                )} seconds before trying again.`,
              },
            ],
          };
        }

        this.logger.debug(`Tool ${name} rate check passed. Remaining: ${rateLimitResult.remaining}`);
      }

      const startTime = Date.now();
      const result = await cb(args, extra);
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

    const tool = super.registerTool(name, config, wrappedCb as ToolCallback<InputArgs>);
    return tool;
  }
}
