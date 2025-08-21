import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import { GetPromptResult, ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

/**
 * NOTE - CURRENTLY THE MAIN MCP SERVER DOES NOT CONSUME THIS YET.
 *
 * TODO: Update this documentation when the main server registered provided McpPrompt instances.
 */
export abstract class McpPrompt<ArgsShape extends PromptArgsRawShape = PromptArgsRawShape> {
  abstract getName(): string;

  abstract getConfig(): McpPromptConfig<ArgsShape>;

  abstract prompt(
    ...args: ArgsShape extends PromptArgsRawShape
      ? [
          args: z.objectOutputType<ArgsShape, z.ZodTypeAny>,
          extra: RequestHandlerExtra<ServerRequest, ServerNotification>
        ]
      : [extra: RequestHandlerExtra<ServerRequest, ServerNotification>]
  ): GetPromptResult | Promise<GetPromptResult>;
}

export type McpPromptConfig<ArgsShape extends PromptArgsRawShape = PromptArgsRawShape> = {
  title?: string;
  description?: string;
  argsSchema?: ArgsShape;
};

// For some reason PromptArgsRawShape isn't exported from "@modelcontextprotocol/sdk/server/mcp.js" so we define it here
export type PromptArgsRawShape = {
  [k: string]: z.ZodType<string, z.ZodTypeDef, string> | z.ZodOptional<z.ZodType<string, z.ZodTypeDef, string>>;
};
