import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import * as Constants from "../constants.js";
import { sanitizePath } from "../utils.js";
import {
  IRuleCreationStrategy,
  RuleCreationInput,
  RuleCreationOutput
} from "../strategies/IRuleCreationStrategy.js";
import { RuleCreationStrategyFactory } from "../strategies/RuleCreationStrategyFactory.js";

// MCP tool wrapper that validates input and delegates rule creation to appropriate strategy.
const DESCRIPTION: string =
  `Purpose: Create a custom rule for code analysis.

Supports two engines:
1. PMD (XPath-based rules) - for Apex, Visualforce, and other languages
2. Regex (Pattern-based rules) - for pattern matching across file types

=== For PMD Engine ===
Workflow for Apex and Visualforce:
- First call "get_ast_nodes_to_generate_xpath" to generate the XPath
- Then call this tool with the generated XPath

Required inputs:
- engine: "pmd"
- xpath: The XPath expression that should match the violation
- ruleName: Name for the custom rule
- description: A short description/message for the rule
- language: Language for the rule (e.g., "apex", "visualforce")
- priority: PMD priority (1-5)
- workingDirectory: Workspace directory where files will be created

Output: Creates a ruleset XML file and updates code-analyzer.yml

=== For Regex Engine ===
Required inputs:
- engine: "regex"
- regex: The regex pattern as string (e.g., "/todo/gi")
- ruleName: Name for the custom rule
- description: Rule description
- violationMessage: Message shown when violation is found
- tags: Array of tags (e.g., ["Security", "BestPractices"])
- severity: Number 1-5 (1=Critical, 2=High, 3=Moderate, 4=Low, 5=Info)
- workingDirectory: Workspace directory where config will be updated

Optional inputs for Regex:
- fileExtensions: Array of file extensions to scan (e.g., [".cls", ".trigger"])
- regexIgnore: Pattern to exclude from matches (e.g., "/^test/i")
- includeMetadata: Boolean flag for metadata inclusion

Output: Updates code-analyzer.yml directly with the regex rule`;

export const inputSchema = z.object({
  engine: z.string().describe("Analysis engine: 'pmd' or 'regex'"),
  ruleName: z.string().describe("Name for the custom rule."),
  description: z.string().describe("Short description of what the rule checks."),
  workingDirectory: z.string().describe("Workspace directory where files will be created (or updated)."),

  // PMD/XPath specific fields
  xpath: z.string().optional().describe("XPath expression that should match the violation (required for PMD)."),
  language: z.string().optional().describe("Language for the rule (e.g., 'apex') - required for PMD."),
  priority: z.number().int().min(1).max(5).optional().describe("PMD priority (1-5) - required for PMD."),

  // Regex specific fields
  regex: z.string().optional().describe("Regex pattern as string (e.g., '/todo/gi') - required for Regex."),
  violationMessage: z.string().optional().describe("Message shown when violation is found - required for Regex."),
  tags: z.array(z.string()).optional().describe("Array of tags (e.g., ['Security']) - required for Regex."),
  severity: z.number().int().min(1).max(5).optional().describe("Severity 1-5 (1=Critical, 5=Info) - required for Regex."),
  fileExtensions: z.array(z.string()).optional().describe("Optional array of file extensions for Regex (e.g., ['.cls'])."),
  regexIgnore: z.string().optional().describe("Optional regex pattern to exclude matches for Regex engine."),
  includeMetadata: z.boolean().optional().describe("Optional boolean flag for metadata inclusion in Regex rules.")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
  status: z.string().describe("'success' or an error message."),
  ruleXml: z.string().optional().describe("Generated PMD ruleset XML for the custom rule."),
  rulesetPath: z.string().optional().describe("Path to the generated PMD ruleset XML."),
  configPath: z.string().optional().describe("Path to the generated/updated code-analyzer.yml."),
  ruleYaml: z.string().optional().describe("Generated YAML for regex rules.")
});
type OutputArgsShape = typeof outputSchema.shape;

export class CreateCustomRuleMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public static readonly NAME: string = "create_custom_rule";
  private readonly strategyFactory: RuleCreationStrategyFactory;
  private readonly telemetryService?: TelemetryService;

  public constructor(
    strategyFactory: RuleCreationStrategyFactory = new RuleCreationStrategyFactory(),
    telemetryService?: TelemetryService
  ) {
    super();
    this.strategyFactory = strategyFactory;
    this.telemetryService = telemetryService;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.CODE_ANALYSIS];
  }

  public getName(): string {
    return CreateCustomRuleMcpTool.NAME;
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Create Custom Rule",
      description: DESCRIPTION,
      inputSchema: inputSchema.shape,
      outputSchema: outputSchema.shape,
      annotations: {
        readOnlyHint: false, // Writes files
        destructiveHint: false, // Does not delete anything
        openWorldHint: false, // Local file operations only
      },
    };
  }

  public async exec(input: z.infer<typeof inputSchema>): Promise<CallToolResult> {
    // Step 1: Validate common inputs
    const commonValidationError = validateCommonInputs(input);
    if (commonValidationError) {
      return commonValidationError;
    }

    // Step 2: Get strategy from factory
    let strategy: IRuleCreationStrategy;
    try {
      strategy = this.strategyFactory.createStrategy(input.engine);
    } catch (error) {
      const supportedEngines = this.strategyFactory.getSupportedEngines().join(", ");
      return buildError(
        `Unsupported engine: '${input.engine}'. Supported engines: ${supportedEngines}`
      );
    }

    // Step 3: Convert to RuleCreationInput
    const ruleInput: RuleCreationInput = {
      engine: input.engine,
      ruleName: input.ruleName,
      description: input.description,
      workingDirectory: input.workingDirectory,
      xpath: input.xpath,
      language: input.language,
      priority: input.priority,
      regex: input.regex,
      violationMessage: input.violationMessage,
      tags: input.tags,
      severity: input.severity,
      fileExtensions: input.fileExtensions,
      regexIgnore: input.regexIgnore,
      includeMetadata: input.includeMetadata
    };

    // Step 4: Engine-specific validation
    const validation = strategy.validate(ruleInput);
    if (!validation.isValid) {
      return buildError(validation.errors.join("; "));
    }

    // Step 5: Execute rule creation
    let output: RuleCreationOutput;
    try {
      output = await strategy.execute(ruleInput);
    } catch (error) {
      return buildError(getErrorMessage(error));
    }

    // Step 6: Emit telemetry
    if (this.telemetryService && output.status === "success") {
      this.telemetryService.sendEvent(Constants.TelemetryEventName, {
        source: Constants.TelemetrySource,
        sfcaEvent: Constants.McpTelemetryEvents.CUSTOM_RULE_CREATED,
        engine: input.engine,
        language: input.language,
        ruleName: input.ruleName,
        rulesetPath: output.rulesetPath,
        configPath: output.configPath
      });
    }

    // Step 7: Build response message
    const message = buildSuccessMessage(output, input.engine);

    return {
      content: [{ type: "text", text: message }],
      structuredContent: output,
      isError: output.status !== "success"
    };
  }
}

function validateCommonInputs(input: z.infer<typeof inputSchema>): CallToolResult | undefined {
  const ruleName = input.ruleName?.trim();
  if (!ruleName) {
    return buildError("ruleName is required. Provide a name for the custom rule.");
  }

  const description = input.description?.trim();
  if (!description) {
    return buildError("description is required. Provide a short description of what the rule checks.");
  }

  const engine = input.engine?.trim();
  if (!engine) {
    return buildError("engine is required. Provide an engine such as 'pmd' or 'regex'.");
  }

  const workingDirectory = input.workingDirectory?.trim();
  if (!workingDirectory) {
    return buildError("workingDirectory is required. Provide a directory where files can be written.");
  }

  if (!sanitizePath(workingDirectory)) {
    return buildError(`Invalid workingDirectory path: ${workingDirectory}. Path must be absolute and not contain traversal sequences.`);
  }

  return undefined;
}

function buildSuccessMessage(output: RuleCreationOutput, engine: string): string {
  if (output.status !== "success") {
    return output.status;
  }

  if (engine.toLowerCase() === "pmd") {
    return output.rulesetPath && output.configPath
      ? `Custom PMD rule created successfully. Ruleset: ${output.rulesetPath}. Config: ${output.configPath}.`
      : output.status;
  } else if (engine.toLowerCase() === "regex") {
    return output.configPath
      ? `Custom Regex rule created successfully. Config: ${output.configPath}.`
      : output.status;
  }

  return output.status;
}

function buildError(status: string): CallToolResult {
  const output = { status };
  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    structuredContent: output,
    isError: true
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
