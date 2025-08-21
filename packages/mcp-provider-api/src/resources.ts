import { ResourceMetadata, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { Variables } from "@modelcontextprotocol/sdk/shared/uriTemplate.js";
import { ReadResourceResult, ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";

export abstract class McpResource {
    kind: 'McpResource' = 'McpResource'

    abstract getName(): string
    
    abstract getUri(): string

    abstract getConfig(): ResourceMetadata
    
    abstract read(
        uri: URL, extra: RequestHandlerExtra<ServerRequest, ServerNotification>
    ): ReadResourceResult | Promise<ReadResourceResult>;
}

export abstract class McpResourceTemplate {
    kind: 'McpResourceTemplate' = 'McpResourceTemplate'

    abstract getName(): string
    
    abstract getTemplate(): ResourceTemplate

    abstract getConfig(): ResourceMetadata
    
    abstract read(
        uri: URL,
        variables: Variables,
        extra: RequestHandlerExtra<ServerRequest, ServerNotification>
    ): ReadResourceResult | Promise<ReadResourceResult>;
}