import { McpTestClient, TransportFactory } from "../src/index.js";
import { z } from "zod";

// Example: Testing a calculator MCP server
async function testCalculatorServer() {
  // Define tool schema for type safety
  const addSchema = {
    name: z.literal("add"),
    params: z.object({
      a: z.number(),
      b: z.number()
    })
  };

  // Create client
  const client = new McpTestClient({
    name: "calculator-test",
    version: "1.0.0",
    timeout: 10000
  });

  try {
    // Connect via stdio transport
    const transport = TransportFactory.createStdio({
      command: "node",
      args: ["path/to/calculator-server.js"]
    });
    
    await client.connect(transport);
    console.log("✅ Connected to calculator server");

    // Test addition tool
    const result = await client.callTool(addSchema, {
      name: "add",
      params: { a: 5, b: 3 }
    });

    console.log("Tool call result:", result);
    
    // In a real test, you'd use your test framework's assertions:
    // expect(result.content[0].text).toBe("8");
    
    if (result.content?.[0]?.text === "8") {
      console.log("✅ Addition test passed!");
    } else {
      console.log("❌ Addition test failed!");
    }

  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await client.disconnect();
    console.log("✅ Disconnected from server");
  }
}

// Example: Using with different test frameworks

// Jest example
export function createJestTest() {
  describe("Calculator MCP Server", () => {
    let client: McpTestClient;

    beforeEach(async () => {
      client = new McpTestClient({ name: "test", version: "1.0.0" });
      const transport = TransportFactory.createStdio({
        command: "node",
        args: ["calculator-server.js"]
      });
      await client.connect(transport);
    });

    afterEach(async () => {
      await client.disconnect();
    });

    test("should add two numbers", async () => {
      const addSchema = {
        name: z.literal("add"),
        params: z.object({ a: z.number(), b: z.number() })
      };

      const result = await client.callTool(addSchema, {
        name: "add",
        params: { a: 2, b: 3 }
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0].text).toBe("5");
    });
  });
}

// Vitest example  
export function createVitestTest() {
  import("vitest").then(({ describe, it, expect, beforeEach, afterEach }) => {
    describe("Calculator MCP Server", () => {
      let client: McpTestClient;

      beforeEach(async () => {
        client = new McpTestClient({ name: "test", version: "1.0.0" });
        const transport = TransportFactory.createStdio({
          command: "node", 
          args: ["calculator-server.js"]
        });
        await client.connect(transport);
      });

      afterEach(async () => {
        await client.disconnect();
      });

      it("should multiply two numbers", async () => {
        const multiplySchema = {
          name: z.literal("multiply"),
          params: z.object({ x: z.number(), y: z.number() })
        };

        const result = await client.callTool(multiplySchema, {
          name: "multiply",
          params: { x: 4, y: 5 }
        });

        expect(result.content[0].text).toBe("20");
      });
    });
  });
}

// Run the basic example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testCalculatorServer().catch(console.error);
}