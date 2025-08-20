import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { CallToolResult, ServerNotification, ServerRequest, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod"
import { MCP_PROVIDER_API_VERSION } from "./constants.js";

export abstract class McpTool<InputArgs extends z.ZodRawShape = z.ZodRawShape, OutputArgs extends z.ZodRawShape = z.ZodRawShape> {
    abstract getToolsets(): Toolset[]

    abstract getName(): string

    abstract getConfig(): McpToolConfig<InputArgs, OutputArgs>

    abstract exec(...args: InputArgs extends z.ZodRawShape
        ? [args: z.objectOutputType<InputArgs, z.ZodTypeAny>, extra: RequestHandlerExtra<ServerRequest, ServerNotification>]
        : [extra: RequestHandlerExtra<ServerRequest, ServerNotification>]
    ): CallToolResult | Promise<CallToolResult>;

    /**
     * This method allows the server to check that this instance is compatible and is able to be registered.
     * Subclasses should not override this method.
     */
    public getVersion(): string {
        return MCP_PROVIDER_API_VERSION;
    }
}

export type McpToolConfig<InputArgs extends z.ZodRawShape = z.ZodRawShape, OutputArgs extends z.ZodRawShape = z.ZodRawShape> = {
    title?: string;
    description?: string;
    inputSchema?: InputArgs;
    outputSchema?: OutputArgs;
    annotations?: ToolAnnotations;
}

// Toolset that a tool should live under
export enum Toolset {
    CORE = 'core',
    DATA = 'data',
    ORGS = 'orgs',
    METADATA = 'metadata',
    TESTING = 'testing',
    USERS = 'users',
    EXPERIMENTAL = 'experimental'
}