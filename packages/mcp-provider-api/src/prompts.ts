import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { GetPromptResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { MCP_PROVIDER_API_VERSION } from "./constants.js";

export abstract class McpPrompt<ArgsShape extends PromptArgsRawShape = PromptArgsRawShape> {
    abstract getName(): string
    
    abstract getConfig(): McpPromptConfig<ArgsShape>

    abstract prompt(...args: ArgsShape extends PromptArgsRawShape
        ? [args: z.objectOutputType<ArgsShape, z.ZodTypeAny>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>]
        : [extra: RequestHandlerExtra<ServerRequest, ServerNotification>]
    ): GetPromptResult | Promise<GetPromptResult>;

    /**
     * This method allows the server to check that this instance is compatible and is able to be registered.
     * Subclasses should not override this method.
     */
    public getVersion(): string {
        return MCP_PROVIDER_API_VERSION;
    }
}

export type McpPromptConfig<ArgsShape extends PromptArgsRawShape = PromptArgsRawShape> = {
    title?: string;
    description?: string;
    argsSchema?: ArgsShape;
}

// For some reason PromptArgsRawShape isn't exported from "@modelcontextprotocol/sdk/server/mcp.js" so we define it here
export type PromptArgsRawShape = {
    [k: string]: z.ZodType<string, z.ZodTypeDef, string> | z.ZodOptional<z.ZodType<string, z.ZodTypeDef, string>>;
};