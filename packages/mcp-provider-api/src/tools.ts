import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { ZodRawShape } from "zod"

export interface McpTool<InputArgs extends ZodRawShape = ZodRawShape, OutputArgs extends ZodRawShape = ZodRawShape> {
    getToolsets(): Toolset[]

    getName(): string
    
    getConfig(): McpToolConfig<InputArgs, OutputArgs>

    exec: ToolCallback<InputArgs>
}

export type McpToolConfig<InputArgs extends ZodRawShape = ZodRawShape, OutputArgs extends ZodRawShape = ZodRawShape> = {
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