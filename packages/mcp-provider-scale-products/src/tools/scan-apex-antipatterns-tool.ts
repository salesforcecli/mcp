import { z } from "zod";
import * as fs from "node:fs";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  McpTool,
  McpToolConfig,
  ReleaseState,
  Toolset,
  TelemetryService,
} from "@salesforce/mcp-provider-api";
import { AntipatternRegistry } from "../antipatterns/antipattern-registry.js";
import { AntipatternModule } from "../antipatterns/antipattern-module.js";
import { GGDDetector } from "../detectors/ggd-detector.js";
import { GGDRecommender } from "../recommenders/ggd-recommender.js";
import { SOQLNoWhereLimitDetector } from "../detectors/soql-no-where-limit-detector.js";
import { SOQLNoWhereLimitRecommender } from "../recommenders/soql-no-where-limit-recommender.js";
import { SOQLUnusedFieldsDetector } from "../detectors/soql-unused-fields-detector.js";
import { SOQLUnusedFieldsRecommender } from "../recommenders/soql-unused-fields-recommender.js";
import { ScanResult, AntipatternResult } from "../models/detection-result.js";

// Define input schema
const scanApexInputSchema = z.object({
  className: z
    .string()
    .describe("Name of the Apex class to scan (e.g., 'AccountController')"),
  apexFilePath: z
    .string()
    .describe("Absolute path to the Apex class file (.cls) to analyze for antipatterns"),
  identifier: z
    .string()
    .optional()
    .describe("Optional unique identifier for this scan (e.g., 'orgId:className'). Defaults to className if not provided."),
});

type InputArgs = z.infer<typeof scanApexInputSchema>;
type InputArgsShape = typeof scanApexInputSchema.shape;
type OutputArgsShape = z.ZodRawShape;

/**
 * MCP Tool for scanning Apex classes for antipatterns
 * Uses the antipattern module architecture to detect and recommend fixes
 */
export class ScanApexAntipatternsTool extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly telemetryService: TelemetryService;
  private readonly antipatternRegistry: AntipatternRegistry;

  public constructor(telemetryService: TelemetryService) {
    super();
    this.telemetryService = telemetryService;
    this.antipatternRegistry = this.initializeRegistry();
  }

  /**
   * Initializes and registers all antipattern modules
   */
  private initializeRegistry(): AntipatternRegistry {
    const registry = new AntipatternRegistry();

    // Register GGD (Schema.getGlobalDescribe) antipattern module
    // Using AST-based detector for accurate syntax tree analysis
    const ggdModule = new AntipatternModule(
      new GGDDetector(),
      new GGDRecommender()
    );
    registry.register(ggdModule);

    // Register SOQL No WHERE/LIMIT antipattern module
    const soqlModule = new AntipatternModule(
      new SOQLNoWhereLimitDetector(),
      new SOQLNoWhereLimitRecommender()
    );
    registry.register(soqlModule);

    // Register SOQL Unused Fields antipattern module
    // Uses ApexGuru patterns for field usage analysis and fix generation
    const soqlUnusedFieldsModule = new AntipatternModule(
      new SOQLUnusedFieldsDetector(),
      new SOQLUnusedFieldsRecommender()
    );
    registry.register(soqlUnusedFieldsModule);
    
    // Future antipatterns can be registered here
    // Example:
    // const soqlModule = new AntipatternModule(
    //   new SOQLInLoopDetector(),
    //   new SOQLInLoopRecommender()
    // );
    // registry.register(soqlModule);
    
    return registry;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.SCALE_PRODUCTS];
  }

  public getName(): string {
    return "scan_apex_class_for_antipatterns";
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Scan Apex Class for Antipatterns",
      description: 
        "Analyzes an Apex class file for performance antipatterns and provides " +
        "recommendations for fixing them. Currently detects: " +
        "1) Schema.getGlobalDescribe() usage with optimized alternatives " +
        "2) SOQL queries without WHERE or LIMIT clauses " +
        "3) SOQL queries with unused fields (with fix generation). " +
        "Distinguishes between different severity levels (e.g., usage in loops vs. ordinary usage). " +
        "Requires an absolute path to the Apex class file.",
      inputSchema: scanApexInputSchema.shape,
      outputSchema: undefined,
      annotations: {
        readOnlyHint: true,
      },
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    // Validate and read the Apex file
    let apexCode: string;
    try {
      // Validate file exists
      if (!fs.existsSync(input.apexFilePath)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: File does not exist: ${input.apexFilePath}`,
            },
          ],
          isError: true,
        };
      }

      // Validate it's not a directory
      const stat = fs.statSync(input.apexFilePath);
      if (stat.isDirectory()) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Path is a directory, not a file: ${input.apexFilePath}`,
            },
          ],
          isError: true,
        };
      }

      // Read the file content
      apexCode = await fs.promises.readFile(input.apexFilePath, "utf-8");
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error reading file '${input.apexFilePath}': ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }

    this.telemetryService.sendEvent("scan_apex_antipatterns_started", {
      className: input.className,
      filePath: input.apexFilePath,
      codeLength: apexCode.length,
    });

    try {
      const antipatternResults: AntipatternResult[] = [];

      // Run all registered antipattern modules
      for (const module of this.antipatternRegistry.getAllModules()) {
        const result = module.scan(input.className, apexCode);
        
        // Only include if instances were detected
        if (result.detectedInstances.length > 0) {
          antipatternResults.push(result);
        }
      }

      // Build final scan result
      const scanResult: ScanResult = {
        antipatternResults,
      };

      // Calculate totals for telemetry
      const totalIssues = antipatternResults.reduce(
        (sum, result) => sum + result.detectedInstances.length,
        0
      );

      this.telemetryService.sendEvent("scan_apex_antipatterns_completed", {
        className: input.className,
        totalIssues,
        antipatternTypes: antipatternResults.map((r) => r.antipatternType).join(","),
      });

      if (totalIssues === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No antipatterns detected in class '${input.className}'. Scanned code: ${apexCode}`,
            },
          ],
        };
      }

      // Format the response with scan result
      const responseText = this.formatResponse(input.className, scanResult);

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      this.telemetryService.sendEvent("scan_apex_antipatterns_error", {
        className: input.className,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        content: [
          {
            type: "text",
            text: `Error scanning class '${input.className}': ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Formats the scan result into a response for the LLM
   */
  private formatResponse(className: string, scanResult: ScanResult): string {
    const totalIssues = scanResult.antipatternResults.reduce(
      (sum, result) => sum + result.detectedInstances.length,
      0
    );

    let response = `# Antipattern Scan Results for '${className}'\n\n`;
    response += `Found ${totalIssues} issue(s) across ${scanResult.antipatternResults.length} antipattern type(s).\n\n`;

    // Add scan results in JSON format
    response += `## Scan Results\n\n`;
    response += "Results are grouped by antipattern type. Each type has:\n";
    response += "- **fixInstruction**: How to fix this antipattern type (applies to all instances)\n";
    response += "- **detectedInstances**: All detected instances of this type\n\n";
    response += "```json\n";
    response += JSON.stringify(scanResult, null, 2);
    response += "\n```\n\n";

    // Note for LLM
    response += `## Instructions for LLM\n\n`;
    response += `The scan result contains multiple antipattern types. For each type:\n`;
    response += `1. Read the \`fixInstruction\` - this explains how to fix this antipattern\n`;
    response += `2. For each instance in \`detectedInstances\`:\n`;
    response += `   - Examine \`codeBefore\` (the problematic code)\n`;
    response += `   - Consider \`severity\` (critical/high/medium/low)\n`;
    response += `   - Generate the fixed code following the instruction\n\n`;
    response += `Generate fixes for all detected instances across all antipattern types.\n`;

    return response;
  }
}
