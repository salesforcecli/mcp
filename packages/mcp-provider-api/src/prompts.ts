import { PromptCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZodOptional, ZodType, ZodTypeDef } from "zod";

export interface McpPrompt<Args extends PromptArgsRawShape = PromptArgsRawShape> {
    getName(): string
    
    getConfig(): McpPromptConfig<Args>

    prompt: PromptCallback<Args>
}

export type McpPromptConfig<Args extends PromptArgsRawShape = PromptArgsRawShape> = {
    title?: string;
    description?: string;
    argsSchema?: Args;
}

// For some reason PromptArgsRawShape isn't exported from "@modelcontextprotocol/sdk/server/mcp.js" so we define it here
export type PromptArgsRawShape = {
    [k: string]: ZodType<string, ZodTypeDef, string> | ZodOptional<ZodType<string, ZodTypeDef, string>>;
};