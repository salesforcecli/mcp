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
const devopsInputSchema = z.object({
  operation: z
    .string()
    .describe("DevOps operation to perform (example for demonstration)"),
});
type InputArgs = z.infer<typeof devopsInputSchema>;
type InputArgsShape = typeof devopsInputSchema.shape;

// Define output schema here:
// (In this case, choosing to not describe an output schema and just let the LLM figure things out)
type OutputArgsShape = z.ZodRawShape;

/**
 * DevOps example tool for demonstration purposes
 */
export class DevOpsExampleTool extends McpTool<InputArgsShape, OutputArgsShape> {
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

  // Must return the name of your tool. Your tool name should start with a 'sf-' prefix. The server may validate this.
  public getName(): string {
    return "sf-devops-example";
  }

  // Must return your tool's configuration
  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "DevOps Example Tool",
      description: "Example DevOps tool for demonstration purposes",
      inputSchema: devopsInputSchema.shape,
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
    this.telemetryService.sendEvent("devOpsOperationEvent", {
      operation: input.operation,
    });

    const result: CallToolResult = {
      content: [
        {
          type: "text",
          text: `DevOps operation requested: ${input.operation}. This is an example tool for demonstration purposes.`,
        },
      ],
    };
    return result;
  }
}
