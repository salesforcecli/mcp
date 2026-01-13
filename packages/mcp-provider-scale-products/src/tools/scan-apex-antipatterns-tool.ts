import { z } from "zod";
import * as fs from "node:fs";
import { Org, type Connection } from "@salesforce/core";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import {
  McpTool,
  McpToolConfig,
  ReleaseState,
  Toolset,
  Services,
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
import { ClassRuntimeData } from "../models/runtime-data.js";
import {
  RuntimeDataService,
  RuntimeDataServiceConfig,
} from "../services/runtime-data-service.js";
import { SOQLRuntimeEnricher } from "../runtime-enrichers/soql-runtime-enricher.js";
import { MethodRuntimeEnricher } from "../runtime-enrichers/method-runtime-enricher.js";

/** Runtime API endpoint path */
const RUNTIME_API_PATH = "/services/data/v65.0/scalemcp/apexguru/class-runtime-data";

// Define input schema - no org parameters needed, resolved automatically
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
 * Automatically enriches detections with runtime data when authenticated to an org
 */
export class ScanApexAntipatternsTool extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly services: Services;
  private readonly antipatternRegistry: AntipatternRegistry;

  public constructor(services: Services) {
    super();
    this.services = services;
    this.antipatternRegistry = this.initializeRegistry();
  }

  /**
   * Initializes and registers all antipattern modules with their runtime enrichers
   */
  private initializeRegistry(): AntipatternRegistry {
    const registry = new AntipatternRegistry();

    // Create shared runtime enrichers
    const soqlRuntimeEnricher = new SOQLRuntimeEnricher();
    const methodRuntimeEnricher = new MethodRuntimeEnricher();

    // Register GGD (Schema.getGlobalDescribe) antipattern module
    // Using AST-based detector for accurate syntax tree analysis
    // Uses MethodRuntimeEnricher for runtime severity calculation
    const ggdModule = new AntipatternModule(
      new GGDDetector(),
      new GGDRecommender(),
      methodRuntimeEnricher
    );
    registry.register(ggdModule);

    // Register SOQL No WHERE/LIMIT antipattern module
    // Uses SOQLRuntimeEnricher for runtime severity calculation
    const soqlModule = new AntipatternModule(
      new SOQLNoWhereLimitDetector(),
      new SOQLNoWhereLimitRecommender(),
      soqlRuntimeEnricher
    );
    registry.register(soqlModule);

    // Register SOQL Unused Fields antipattern module
    // Performs field usage analysis and generates optimized queries
    // Uses SOQLRuntimeEnricher for runtime severity calculation
    const soqlUnusedFieldsModule = new AntipatternModule(
      new SOQLUnusedFieldsDetector(),
      new SOQLUnusedFieldsRecommender(),
      soqlRuntimeEnricher
    );
    registry.register(soqlUnusedFieldsModule);
    
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
        "When authenticated to an org with ApexGuru enabled, severity is calculated from actual runtime metrics. " +
        "Requires an absolute path to the Apex class file.",
      inputSchema: scanApexInputSchema.shape,
      outputSchema: undefined,
      annotations: {
        readOnlyHint: true,
      },
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    const telemetryService = this.services.getTelemetryService();
    
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

    // Try to resolve org connection for runtime data
    const orgInfo = await this.resolveOrgConnection();

    telemetryService.sendEvent("scan_apex_antipatterns_started", {
      className: input.className,
      filePath: input.apexFilePath,
      codeLength: apexCode.length,
      hasOrgConnection: orgInfo !== null,
    });

    try {
      // Fetch runtime data if org connection is available
      let classRuntimeData: ClassRuntimeData | undefined;
      let runtimeDataFetched = false;

      if (orgInfo) {
        classRuntimeData = await this.fetchRuntimeData(
          orgInfo.connection,
          orgInfo.orgId,
          orgInfo.userId,
          input.className
        );
        runtimeDataFetched = classRuntimeData !== undefined;
      }

      const antipatternResults: AntipatternResult[] = [];

      // Run all registered antipattern modules with optional runtime data
      for (const module of this.antipatternRegistry.getAllModules()) {
        const result = module.scan(input.className, apexCode, classRuntimeData);
        
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

      telemetryService.sendEvent("scan_apex_antipatterns_completed", {
        className: input.className,
        totalIssues,
        antipatternTypes: antipatternResults.map((r) => r.antipatternType).join(","),
        runtimeDataUsed: runtimeDataFetched,
      });

      if (totalIssues === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No antipatterns detected in class '${input.className}'.`,
            },
          ],
        };
      }

      // Format the response with scan result
      const responseText = this.formatResponse(
        input.className,
        scanResult,
        runtimeDataFetched
      );

      return {
        content: [
          {
            type: "text",
            text: responseText,
          },
        ],
      };
    } catch (error) {
      telemetryService.sendEvent("scan_apex_antipatterns_error", {
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
   * Resolves org connection from the default target org
   * Returns null if no org is authenticated
   * 
   * @returns Object with orgId, instanceUrl, connection, and userId, or null if unavailable
   */
  private async resolveOrgConnection(): Promise<{ 
    orgId: string; 
    instanceUrl: string; 
    connection: Connection;
    userId: string;
  } | null> {
    try {
      const orgService = this.services.getOrgService();
      const defaultOrg = await orgService.getDefaultTargetOrg();

      // OrgConfigInfo stores username in the 'value' property
      if (!defaultOrg?.value) {
        return null;
      }

      const connection = await orgService.getConnection(defaultOrg.value);
      const org = await Org.create({ connection });
      const orgId = org.getOrgId();
      const instanceUrl = connection.instanceUrl;
      const userId = connection.getUsername();
      console.log("orgId", orgId);
      console.log("instanceUrl", instanceUrl);
      console.log("userId", userId);
      if (!orgId || !instanceUrl || !userId) {
        return null;
      }

      return { orgId, instanceUrl, connection, userId };
    } catch (error) {
      // Log but don't fail - we'll continue with static analysis
      console.warn(
        "Could not resolve org connection for runtime data:",
        error instanceof Error ? error.message : String(error)
      );
      return null;
    }
  }

  /**
   * Fetches runtime data for a class from the ApexGuru Connect endpoint
   * Returns undefined on failure for graceful fallback
   * 
   * @param connection - Salesforce connection object
   * @param orgId - Salesforce Org ID
   * @param userId - Salesforce User ID
   * @param className - Name of the Apex class
   * @returns ClassRuntimeData if available, undefined otherwise
   */
  private async fetchRuntimeData(
    connection: Connection,
    orgId: string,
    userId: string,
    className: string
  ): Promise<ClassRuntimeData | undefined> {
    try {
      const config: RuntimeDataServiceConfig = {
        apiPath: RUNTIME_API_PATH,
        timeoutMs: 30000,
        retryAttempts: 2,
      };

      const service = new RuntimeDataService(config);
      const requestId = RuntimeDataService.generateRequestId(orgId, userId);
      console.log("requestId", requestId);

      const report = await service.fetchRuntimeData(connection, {
        requestId,
        orgId,
        classes: [className],
      });
      if (report) {
        
        return RuntimeDataService.getClassData(report, className);
      }

      return undefined;
    } catch (error) {
      console.warn(
        `Failed to fetch runtime data for ${className}:`,
        error instanceof Error ? error.message : String(error)
      );
      return undefined;
    }
  }

  /**
   * Formats the scan result into a response for the LLM
   */
  private formatResponse(
    className: string,
    scanResult: ScanResult,
    runtimeDataUsed: boolean
  ): string {
    const totalIssues = scanResult.antipatternResults.reduce(
      (sum, result) => sum + result.detectedInstances.length,
      0
    );

    let response = `# Antipattern Scan Results for '${className}'\n\n`;
    response += `Found ${totalIssues} issue(s) across ${scanResult.antipatternResults.length} antipattern type(s).\n`;
    
    if (runtimeDataUsed) {
      response += `\n**Note:** Severity levels are based on actual runtime metrics from the org.\n`;
    } else {
      response += `\n**Note:** This report is based on Static Analysis only. In order to leverage Runtime insights, make sure you are authenticated to an org and onboarded to ApexGuru.\n`;
    }
    response += `\n`;

    // Add scan results in JSON format
    response += `## Scan Results\n\n`;
    response += "Results are grouped by antipattern type. Each type has:\n";
    response += "- **fixInstruction**: How to fix this antipattern type (applies to all instances)\n";
    response += "- **detectedInstances**: All detected instances of this type\n\n";
    response += "**Legend:** 💡 = Severity calculated from actual runtime metrics\n\n";
    
    // Transform results to add bulb icon for runtime-derived severity
    const displayResult = this.addSeverityIcons(scanResult);
    
    response += "```json\n";
    response += JSON.stringify(displayResult, null, 2);
    response += "\n```\n\n";

    // Note for LLM
    response += `## Instructions for LLM\n\n`;
    response += `The scan result contains multiple antipattern types. For each type:\n`;
    response += `1. Read the \`fixInstruction\` - this explains how to fix this antipattern\n`;
    response += `2. For each instance in \`detectedInstances\`:\n`;
    response += `   - Examine \`codeBefore\` (the problematic code)\n`;
    response += `   - Consider \`severity\` (critical/major/minor)\n`;
    response += `   - Generate the fixed code following the instruction\n\n`;
    response += `Generate fixes for all detected instances across all antipattern types.\n`;

    return response;
  }

  /**
   * Transform scan results to add 💡 icon for runtime-derived severity
   * Creates a display-friendly copy of the results
   * Removes internal severitySource field from output
   */
  private addSeverityIcons(scanResult: ScanResult): object {
    return {
      antipatternResults: scanResult.antipatternResults.map((result) => ({
        ...result,
        detectedInstances: result.detectedInstances.map((instance) => {
          // Destructure to separate severitySource from rest of properties
          const { severitySource, ...rest } = instance;
          return {
            ...rest,
            // Add bulb icon when severity was calculated from runtime data
            severity: severitySource === "runtime" 
              ? `💡 ${instance.severity}` 
              : instance.severity,
          };
        }),
      })),
    };
  }
}
