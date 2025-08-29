import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { CallToolResult, ServerNotification, ServerRequest, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { ReleaseState, Toolset } from './enums.js';

/**
 * Defines an tool that can be registered with an MCP Server.
 */
export abstract class McpTool<
  InputArgsShape extends z.ZodRawShape = z.ZodRawShape,
  OutputArgsShape extends z.ZodRawShape = z.ZodRawShape
> {

  /**
   * Returns the release state of the tool.
   */
  public abstract getReleaseState(): ReleaseState

  /**
   * Returns one or more toolsets that the tool should be associated with
   */
  public abstract getToolsets(): Toolset[];

  /**
   * Returns the name for the MCP Tool
   */
  public abstract getName(): string;

  /**
   * Returns the configuration for the MCP Tool
   */
  public abstract getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape>;

  /**
   * Implements the main callback for the MCP Tool
   */
  public abstract exec(
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