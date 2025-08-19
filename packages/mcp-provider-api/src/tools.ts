import { ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { ZodRawShape } from "zod"

export interface McpTool<InputArgs extends ZodRawShape = ZodRawShape, OutputArgs extends ZodRawShape = ZodRawShape> {
    getToolset(): Toolset

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
    ORGS = 'orgs',
    DATA = 'data',
    USERS = 'users',
    METADATA = 'metadata',
    TESTING = 'testing',
    EXPERIMENTAL = 'experimental'
}