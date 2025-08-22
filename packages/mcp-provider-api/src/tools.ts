import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { CallToolResult, ServerNotification, ServerRequest, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { Toolset } from './toolset.js';

/**
 * Defines an tool that can be registered with an MCP Server.
 */
export abstract class McpTool<
  InputArgsShape extends z.ZodRawShape = z.ZodRawShape,
  OutputArgsShape extends z.ZodRawShape = z.ZodRawShape
> {
  abstract getToolsets(): Toolset[];

  abstract getName(): string;

  abstract getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape>;

  abstract exec(
    ...args: InputArgsShape extends z.ZodRawShape
      ? [
          args: z.objectOutputType<InputArgsShape, z.ZodTypeAny>,
          extra: RequestHandlerExtra<ServerRequest, ServerNotification>
        ]
      : [extra: RequestHandlerExtra<ServerRequest, ServerNotification>]
  ): CallToolResult | Promise<CallToolResult>;
}

export type McpToolConfig<
  InputArgsShape extends z.ZodRawShape = z.ZodRawShape,
  OutputArgsShape extends z.ZodRawShape = z.ZodRawShape
> = {
  title?: string;
  description?: string;
  inputSchema?: InputArgsShape;
  outputSchema?: OutputArgsShape;
  annotations?: ToolAnnotations;
};
