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
  RuntimeDataStatus,
} from "../services/runtime-data-service.js";
import { ScaleTelemetryService } from "../services/scale-telemetry-service.js";
import { SOQLRuntimeEnricher } from "../runtime-enrichers/soql-runtime-enricher.js";
import { MethodRuntimeEnricher } from "../runtime-enrichers/method-runtime-enricher.js";
import { directoryParam, usernameOrAliasParam } from "../shared/params.js";

/** Runtime API endpoint base path (API version will be dynamically inserted) */
const RUNTIME_API_BASE_PATH = "/services/data/{version}/scalemcp/apexguru/class-runtime-data";

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
  directory: directoryParam,
  usernameOrAlias: usernameOrAliasParam,
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
  private readonly scaleTelemetryService: ScaleTelemetryService;

  public constructor(services: Services) {
    super();
    this.services = services;
    this.antipatternRegistry = this.initializeRegistry();
    const telemetryService = this.services.getTelemetryService();
    this.scaleTelemetryService = new ScaleTelemetryService(telemetryService);
  }

  /**
   * Initializes and registers all antipattern modules with their runtime enrichers
   */
  private initializeRegistry(): AntipatternRegistry {
    const registry = new AntipatternRegistry();

    const soqlRuntimeEnricher = new SOQLRuntimeEnricher();
    const methodRuntimeEnricher = new MethodRuntimeEnricher();

    const ggdModule = new AntipatternModule(
      new GGDDetector(),
      new GGDRecommender(),
      methodRuntimeEnricher
    );
    registry.register(ggdModule);

  
    const soqlModule = new AntipatternModule(
      new SOQLNoWhereLimitDetector(),
      new SOQLNoWhereLimitRecommender(),
      soqlRuntimeEnricher
    );
    registry.register(soqlModule);

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
    process.chdir(input.directory);
    
    const orgInfo = await this.resolveOrgConnection(input.usernameOrAlias);
    
    this.scaleTelemetryService.emitToolInvocation(
      this.getName(),
      orgInfo,
      {
        className: input.className,
        hasOrgConnection: orgInfo !== null,
      }
    );
    
   let apexCode: string;
    try {
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

      // Validate it's an Apex file (.cls or .trigger)
      const validExtensions = ['.cls', '.trigger'];
      const fileExtension = input.apexFilePath.toLowerCase().slice(input.apexFilePath.lastIndexOf('.'));
      if (!validExtensions.includes(fileExtension)) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Invalid file type. This tool only scans Apex files (.cls or .trigger). Received: ${input.apexFilePath}`,
            },
          ],
          isError: true,
        };
      }

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

    try {
      let classRuntimeData: ClassRuntimeData | undefined;
      let runtimeDataStatus: RuntimeDataStatus = RuntimeDataStatus.NO_ORG_CONNECTION;

      let requestId: string | undefined;

      if (orgInfo) {
        const runtimeResult = await this.fetchRuntimeData(
          orgInfo.connection,
          orgInfo.orgId,
          orgInfo.userId,
          input.className
        );
        classRuntimeData = runtimeResult.data;
        runtimeDataStatus = runtimeResult.status;
        requestId = runtimeResult.requestId;

        if (runtimeDataStatus !== RuntimeDataStatus.SUCCESS) {
          const errorType = runtimeDataStatus === RuntimeDataStatus.ACCESS_DENIED
            ? "ACCESS_DENIED"
            : runtimeDataStatus === RuntimeDataStatus.NO_ORG_CONNECTION
            ? "NO_ORG_CONNECTION"
            : "API_ERROR";
          
          this.scaleTelemetryService.emitRuntimeFetchError(
            this.getName(),
            orgInfo,
            input.className,
            errorType,
            runtimeResult.message || `Runtime data fetch failed with status: ${runtimeDataStatus}`,
            requestId
          );
        }
      }

      const antipatternResults: AntipatternResult[] = [];

      for (const module of this.antipatternRegistry.getAllModules()) {
        const result = module.scan(input.className, apexCode, classRuntimeData);
        
        if (result.detectedInstances.length > 0) {
          antipatternResults.push(result);
        }
      }

      const scanResult: ScanResult = {
        antipatternResults,
      };

      const totalAntipatterns = antipatternResults.reduce(
        (sum, result) => sum + result.detectedInstances.length,
        0
      );

      this.scaleTelemetryService.emitScanResults(
        this.getName(),
        orgInfo,
        scanResult,
        input.className,
        runtimeDataStatus,
        requestId
      );

      if (totalAntipatterns === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No antipatterns detected in class '${input.className}'.`,
            },
          ],
        };
      }

      const responseText = this.formatResponse(
        input.className,
        scanResult,
        runtimeDataStatus
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
      this.scaleTelemetryService.emitExecutionError(
        this.getName(),
        orgInfo,
        input.className,
        error instanceof Error ? error.message : String(error)
      );

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
   * Resolves org connection from the explicitly provided username/alias
   * Returns null if usernameOrAlias is not provided (will proceed with static-only analysis)
   * 
   * Users must explicitly specify which org to use via usernameOrAlias parameter.
   * 
   * @param usernameOrAlias - Username or alias for the org to use (must be explicitly provided)
   * @returns Object with orgId, instanceUrl, connection, and userId, or null if usernameOrAlias not provided
   */
  private async resolveOrgConnection(usernameOrAlias?: string): Promise<{ 
    orgId: string; 
    instanceUrl: string; 
    connection: Connection;
    userId: string;
  } | null> {
    if (!usernameOrAlias) {
      return null;
    }

    try {
      const orgService = this.services.getOrgService();
      const connection = await orgService.getConnection(usernameOrAlias);
      const org = await Org.create({ connection });
      const orgId = org.getOrgId();
      const instanceUrl = connection.instanceUrl;
      const userId = connection.getUsername();
      if (!orgId || !instanceUrl || !userId) {
        return null;
      }

      return { orgId, instanceUrl, connection, userId };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetches runtime data for a class from the ApexGuru Connect endpoint
   * Returns result with status and optional data for appropriate messaging
   * 
   * @param connection - Salesforce connection object
   * @param orgId - Salesforce Org ID
   * @param userId - Salesforce User ID
   * @param className - Name of the Apex class
   * @returns Object containing status, optional ClassRuntimeData, requestId, and message
   */
  private async fetchRuntimeData(
    connection: Connection,
    orgId: string,
    userId: string,
    className: string
  ): Promise<{ 
    data: ClassRuntimeData | undefined; 
    status: RuntimeDataStatus;
    requestId?: string;
    message?: string;
  }> {
    try {
      const apiVersion = connection.getApiVersion();
      const apiPath = RUNTIME_API_BASE_PATH.replace("{version}", `v${apiVersion}`);
      const config: RuntimeDataServiceConfig = {
        apiPath,
        timeoutMs: 30000,
        retryAttempts: 2,
      };

      const service = new RuntimeDataService(config);
      const requestId = RuntimeDataService.generateRequestId(orgId, userId);

      const requestPayload = {
        requestId,
        orgId,
        classes: [className],
      };

      const result = await service.fetchRuntimeData(connection, requestPayload);
      
      if (result.report) {
        const classData = RuntimeDataService.getClassData(result.report, className);
        
        return {
          data: classData,
          status: result.status,
          requestId,
          message: result.message,
        };
      }

      return {
        data: undefined,
        status: result.status,
        requestId,
        message: result.message,
      };
    } catch (error) {
      return {
        data: undefined,
        status: RuntimeDataStatus.API_ERROR,
        requestId: RuntimeDataService.generateRequestId(orgId, userId),
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Formats the scan result into a response for the LLM
   */
  private formatResponse(
    className: string,
    scanResult: ScanResult,
    runtimeDataStatus: RuntimeDataStatus
  ): string {
    const totalIssues = scanResult.antipatternResults.reduce(
      (sum, result) => sum + result.detectedInstances.length,
      0
    );

    let response = `# Antipattern Scan Results for '${className}'\n\n`;
    response += `Found ${totalIssues} issue(s) across ${scanResult.antipatternResults.length} antipattern type(s).\n`;
    
    response += this.getRuntimeDataMessage(runtimeDataStatus);
    response += `\n`;

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
   * Returns the appropriate message based on runtime data fetch status
   */
  private getRuntimeDataMessage(status: RuntimeDataStatus): string {
    switch (status) {
      case RuntimeDataStatus.SUCCESS:
        return `\n**Note:** Severity levels are based on actual runtime metrics from the org.\n`;
      
      case RuntimeDataStatus.ACCESS_DENIED:
        return `\n**Note:** ApexGuru (static analysis) is active. To unlock runtime intelligence and see how this code affects your production org, contact Salesforce Support to enable the full Scale Center suite.\n`;
      
      case RuntimeDataStatus.NO_ORG_CONNECTION:
        return `\n**Note:** Showing static insights only. Sign in to an authorized Salesforce org to correlate these code violations with production runtime metrics from ApexGuru.\n`;
      
      case RuntimeDataStatus.API_ERROR:
      default:
        return `\n**Note:** Showing static insights only. Unable to fetch runtime metrics from ApexGuru. Please try again or verify your org has the Scale Center suite enabled.\n`;
    }
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
