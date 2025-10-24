import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  McpTool,
  McpToolConfig,
  ReleaseState,
  TelemetryService,
  Toolset,
} from "@salesforce/mcp-provider-api";

// Define input schema here:
const exampleInputSchema = z.object({
  someInput: z
    .string()
    .describe("an input argument to be used for example purposes"),
});
type InputArgs = z.infer<typeof exampleInputSchema>;
type InputArgsShape = typeof exampleInputSchema.shape;

// Define output schema here:
// (In this case, choosing to not describe an output schema and just let the LLM figure things out)
type OutputArgsShape = z.ZodRawShape;

/**
 * Example tool for demonstration puproses
 */
export class ExampleMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly telemetryService: TelemetryService;

  // It is nice to inject your dependencies into a constructor to make unit testing easier
  public constructor(telemetryService: TelemetryService) {
    super();
    this.telemetryService = telemetryService;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  // Must return which toolsets your tool should belong to
  public getToolsets(): Toolset[] {
    return [Toolset.OTHER];
  }

  // Must return the name of your tool.
  // For internal naming guidelines see:
  //  https://confluence.internal.salesforce.com/spaces/DOCTEAM/pages/1166876463/MCP+Server+Terminology+and+Style+Guide
  public getName(): string {
    return "example_tool";
  }

  // Must return your tool's configuration
  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Example Tool",
      description: "Example Description",
      inputSchema: exampleInputSchema.shape,
      outputSchema: undefined,
      annotations: {
        readOnlyHint: true,
      },
    };
  }

  // This method serves as your tool's callback which takes the input and returns an output.
  // Note that you could also use an async signature like: public async exec(input: InputArgs): Promise<CallToolResult>
  public exec(input: InputArgs): CallToolResult {
    // Example of using the telemetry service
    this.telemetryService.sendEvent("sampleEvent", {
      someAttribute: "someAttributeValue",
    });

    const result: CallToolResult = {
      content: [
        {
          type: "text",
          text: "The input that was received: " + JSON.stringify(input),
        },
      ],
    };
    return result;
  }
}
