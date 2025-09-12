import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolResult,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  InitializeResultSchema,
  CallToolResultSchema,
  JSONRPCMessage,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export interface McpTestClientOptions {
  timeout?: number;
}

export interface ToolSchema<TName extends string = string, TParams = unknown> {
  name: z.ZodLiteral<TName> | z.ZodString;
  params: z.ZodSchema<TParams>;
}

export class McpTestClient {
  private transport?: Transport;
  private requestId = 1;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
      timeout?: NodeJS.Timeout;
    }
  >();
  private isConnected = false;
  private defaultTimeout: number;

  constructor(options: McpTestClientOptions) {
    this.defaultTimeout = options.timeout ?? 30000;
  }

  async connect(transport: Transport): Promise<void> {
    if (this.isConnected) {
      throw new Error('Client is already connected');
    }

    this.transport = transport;

    transport.onmessage = (message: unknown) => {
      this.handleMessage(message);
    };

    transport.onerror = (error: Error) => {
      this.handleError(error);
    };

    transport.onclose = () => {
      this.handleClose();
    };

    await transport.start?.();

    const initResult = await this.sendRequest({
      method: 'initialize',
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: {
          name: '@salesforce/mcp-test-client',
          version: '0.0.1',
        },
      },
    });

    const result = InitializeResultSchema.parse(initResult);

    if (!SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion)) {
      throw new Error(
        `Unsupported protocol version: ${result.protocolVersion}`,
      );
    }

    await this.sendNotification({
      method: 'notifications/initialized',
    });

    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.transport) {
      return;
    }

    for (const [, request] of this.pendingRequests) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();

    await this.transport.close?.();
    this.transport = undefined;
    this.isConnected = false;
  }

  async callTool<TName extends string, TParams>(
    toolSchema: ToolSchema<TName, TParams>,
    request: { name: TName; params: TParams },
    timeout?: number,
  ): Promise<CallToolResult> {
    if (!this.isConnected || !this.transport) {
      throw new Error('Client is not connected');
    }

    const parsedRequest = z
      .object({
        name: toolSchema.name,
        params: toolSchema.params,
      })
      .parse(request);

    const result = await this.sendRequest(
      {
        method: 'tools/call',
        params: {
          name: parsedRequest.name,
          arguments: parsedRequest.params,
        },
      },
      timeout,
    );

    return CallToolResultSchema.parse(result);
  }

  private async sendRequest(
    request: unknown,
    timeout?: number,
  ): Promise<unknown> {
    if (!this.transport) {
      throw new Error('No transport available');
    }

    const id = this.requestId++;
    const message = {
      jsonrpc: '2.0' as const,
      id,
      ...(request as Record<string, unknown>),
    };

    return new Promise((resolve, reject) => {
      const timeoutMs = timeout ?? this.defaultTimeout;
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (result: unknown) => {
          clearTimeout(timeoutHandle);
          resolve(result);
        },
        reject: (error: unknown) => {
          clearTimeout(timeoutHandle);
          reject(error);
        },
        timeout: timeoutHandle,
      });

      this.transport!.send(message as JSONRPCMessage);
    });
  }

  private async sendNotification(notification: unknown): Promise<void> {
    if (!this.transport) {
      throw new Error('No transport available');
    }

    const message = {
      jsonrpc: '2.0' as const,
      ...(notification as Record<string, unknown>),
    };

    this.transport.send(message as JSONRPCMessage);
  }

  private handleMessage(message: unknown): void {
    const msg = message as Record<string, unknown>;
    if (msg.id !== undefined && typeof msg.id === 'number') {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);

        if (msg.error) {
          const error = msg.error as Record<string, unknown>;
          pending.reject(
            new Error((error.message as string) || 'Unknown error'),
          );
        } else {
          pending.resolve(msg.result);
        }
      }
    }
  }

  private handleError(error: Error): void {
    for (const [, request] of this.pendingRequests) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(error);
    }
    this.pendingRequests.clear();
  }

  private handleClose(): void {
    this.isConnected = false;
    for (const [, request] of this.pendingRequests) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

// Re-export everything for convenience
export * from './transport.js';
export * from './utils.js';
export * from './errors.js';
