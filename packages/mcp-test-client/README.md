# MCP Test Client

A type-safe MCP (Model Context Protocol) client designed specifically for testing scenarios. This library provides a simplified interface for calling MCP tools with Zod schema validation, making it easy to write robust tests without built-in assertions.

## Features

- **Type-safe tool calling**: Use Zod schemas to define tool parameters with full TypeScript support
- **Test runner agnostic**: No built-in assertions - works with any test framework (Jest, Vitest, Mocha, etc.)
- **Node.js focused**: Optimized for Node.js v20+ with cross-platform support (Linux/Windows)
- **Multiple transports**: Support for stdio, SSE, and WebSocket connections
- **Automatic cleanup**: Built-in utilities for proper resource management in tests
- **Minimal dependencies**: Only essential MCP SDK types and Zod

## Installation

```bash
npm install @salesforce/mcp-test-client
```

## Quick Start

```typescript
import { McpTestClient, TransportFactory } from "@salesforce/mcp-test-client";
import { z } from "zod";

// Define your tool schema with Zod
const addNumbersSchema = {
  name: z.literal("add_numbers"),
  params: z.object({
    a: z.number(),
    b: z.number()
  })
};

// Create and connect client
const client = new McpTestClient({
  name: "test-client",
  version: "1.0.0"
});

const transport = TransportFactory.createStdio({
  command: "node",
  args: ["path/to/your/mcp-server.js"]
});

await client.connect(transport);

// Call tool with type safety
const result = await client.callTool(addNumbersSchema, {
  name: "add_numbers",
  params: { a: 5, b: 3 }
});

// Use with your test framework
expect(result.content[0].text).toBe("8");

// Clean up
await client.disconnect();
```

## API Reference

### McpTestClient

The main client class for interacting with MCP servers.

#### Constructor

```typescript
new McpTestClient(options: McpTestClientOptions)
```

**Options:**
- `name` (string): Client name for identification
- `version` (string): Client version
- `timeout` (number, optional): Default request timeout in milliseconds (default: 30000)

#### Methods

##### `connect(transport: Transport): Promise<void>`

Connects to an MCP server using the specified transport and performs initialization.

##### `callTool<TName, TParams>(schema: ToolSchema<TName, TParams>, request: { name: TName; params: TParams }, timeout?: number): Promise<CallToolResult>`

Calls an MCP tool with type-safe parameter validation.

**Parameters:**
- `schema`: Zod schema defining the tool name and parameters
- `request`: Tool call request matching the schema
- `timeout`: Optional timeout override for this request

**Returns:** Promise resolving to the tool call result

##### `disconnect(): Promise<void>`

Disconnects from the server and cleans up resources.

##### `connected: boolean`

Read-only property indicating connection status.

### TransportFactory

Factory class for creating transport instances.

#### Static Methods

##### `createStdio(options: StdioTransportOptions): Transport`

Creates a stdio transport for subprocess communication.

**Options:**
- `command` (string): Command to execute
- `args` (string[], optional): Command arguments
- `env` (Record<string, string>, optional): Environment variables

##### `createSSE(options: SSETransportOptions): Transport`

Creates an SSE transport for HTTP-based communication.

**Options:**
- `url` (string): Server URL
- `headers` (Record<string, string>, optional): HTTP headers

### Utility Functions

#### `withMcpClient<T>(clientFactory: () => Promise<McpTestClient>, testFn: (client: McpTestClient, setup: TestSetup) => Promise<T>): Promise<T>`

Higher-order function that ensures proper cleanup of MCP client resources.

```typescript
import { withMcpClient, TransportFactory } from "@salesforce/mcp-test-client";

await withMcpClient(
  async () => {
    const client = new McpTestClient({ name: "test", version: "1.0.0" });
    await client.connect(TransportFactory.createStdio({ command: "node", args: ["server.js"] }));
    return client;
  },
  async (client, setup) => {
    // Your test logic here
    const result = await client.callTool(schema, request);
    expect(result).toBeDefined();
    
    // setup.onCleanup() can be used for additional cleanup
  }
);
```

## Examples

### Basic Tool Testing

```typescript
import { describe, it, expect } from "vitest";
import { McpTestClient, TransportFactory } from "@salesforce/mcp-test-client";
import { z } from "zod";

describe("Calculator Tool", () => {
  const client = new McpTestClient({ name: "test", version: "1.0.0" });

  beforeAll(async () => {
    const transport = TransportFactory.createStdio({
      command: "node",
      args: ["calculator-server.js"]
    });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.disconnect();
  });

  it("should add two numbers", async () => {
    const addSchema = {
      name: z.literal("add"),
      params: z.object({
        a: z.number(),
        b: z.number()
      })
    };

    const result = await client.callTool(addSchema, {
      name: "add",
      params: { a: 2, b: 3 }
    });

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe("5");
  });
});
```

### Error Handling

```typescript
import { McpTestClientError, ToolCallError } from "@salesforce/mcp-test-client/errors";

try {
  const result = await client.callTool(schema, invalidRequest);
} catch (error) {
  if (error instanceof ToolCallError) {
    console.log(`Tool ${error.toolName} failed: ${error.message}`);
  } else if (error instanceof McpTestClientError) {
    console.log(`Client error: ${error.message}`);
  }
}
```

### Complex Tool Schemas

```typescript
// File operation tool
const readFileSchema = {
  name: z.literal("read_file"),
  params: z.object({
    path: z.string(),
    encoding: z.enum(["utf8", "binary"]).default("utf8"),
    lines: z.object({
      start: z.number().min(1),
      end: z.number().min(1)
    }).optional()
  })
};

// Database query tool
const querySchema = {
  name: z.literal("execute_query"),
  params: z.object({
    sql: z.string(),
    parameters: z.record(z.any()).optional(),
    timeout: z.number().positive().default(30000)
  })
};
```

## Platform Support

- **Node.js**: v20.0.0 or higher
- **Operating Systems**: Linux, Windows, macOS
- **Module System**: ESM only

## License

Apache-2.0
