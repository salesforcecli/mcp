import { ReadResourceCallback, ReadResourceTemplateCallback, ResourceMetadata, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

export interface McpResource {
    kind: 'McpResource'

    getName(): string
    
    getUri(): string

    getConfig(): ResourceMetadata
    
    read: ReadResourceCallback
}

export interface McpResourceTemplate {
    kind: 'McpResourceTemplate'

    getName(): string
    
    getTemplate(): ResourceTemplate

    getConfig(): ResourceMetadata
    
    read: ReadResourceTemplateCallback
}