import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import * as Constants from "../constants.js";
import {
  CreateRegexCustomRuleAction,
  CreateRegexCustomRuleActionImpl,
  CreateRegexCustomRuleInput,
  CreateRegexCustomRuleOutput
} from "../actions/create-regex-custom-rule.js";

// TEMPORARY TOOL FOR TESTING REGEX RULE CREATION - WILL BE DELETED LATER
const DESCRIPTION: string =
  `TEMPORARY TOOL: Create a custom regex rule for pattern matching.

This tool adds regex-based custom rules directly to code-analyzer.yml.

Required inputs:
- regex: The regex pattern as string (e.g., "/todo/gi", "/[a-zA-Z0-9]{15,18}/g")
- ruleName: Name for the custom rule
- description: Rule description
- violationMessage: Message shown when violation is found
- tags: Array of tags (e.g., ["Security", "BestPractices"])
- severity: Number 1-5 (1=Critical, 2=High, 3=Moderate, 4=Low, 5=Info)
- workingDirectory: Workspace directory where code-analyzer.yml will be updated

Optional inputs:
- fileExtensions: Array of file extensions to scan (e.g., [".cls", ".trigger"])
- regexIgnore: Pattern to exclude from matches (e.g., "/^test/i")
- includeMetadata: Boolean flag for metadata inclusion

Output:
- configPath: Path to the updated code-analyzer.yml
- ruleYaml: The generated YAML for the rule`;

export const inputSchema = z.object({
  regex: z.string().describe("Regex pattern as string (e.g., '/todo/gi'). Must be in format '/pattern/flags'."),
  ruleName: z.string().describe("Name for the custom rule."),
  description: z.string().describe("Short description of what the rule checks."),
  violationMessage: z.string().describe("Message shown when violation is found."),
  tags: z.array(z.string()).describe("Array of tags (e.g., ['Security', 'BestPractices'])."),
  severity: z.number().int().min(1).max(5).describe("Severity level: 1=Critical, 2=High, 3=Moderate, 4=Low, 5=Info."),
  workingDirectory: z.string().describe("Workspace directory where code-analyzer.yml will be created/updated."),
  fileExtensions: z.array(z.string()).optional().describe("Optional array of file extensions (e.g., ['.cls', '.trigger'])."),
  regexIgnore: z.string().optional().describe("Optional regex pattern to exclude matches (e.g., '/^test/i')."),
  includeMetadata: z.boolean().optional().describe("Optional boolean flag for metadata inclusion.")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
  status: z.string().describe("'success' or an error message."),
  ruleYaml: z.string().optional().describe("Generated YAML for the regex rule."),
  configPath: z.string().optional().describe("Path to the updated code-analyzer.yml.")
});
type OutputArgsShape = typeof outputSchema.shape;

export class CreateRegexRuleMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public static readonly NAME: string = "create_regex_rule";
  private readonly action: CreateRegexCustomRuleAction;
  private readonly telemetryService?: TelemetryService;

  public constructor(
    action: CreateRegexCustomRuleAction = new CreateRegexCustomRuleActionImpl(),
    telemetryService?: TelemetryService
  ) {
    super();
    this.action = action;
    this.telemetryService = telemetryService;
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.NON_GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.CODE_ANALYSIS];
  }

  public getName(): string {
    return CreateRegexRuleMcpTool.NAME;
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Create Regex Rule (TEMPORARY)",
      description: DESCRIPTION,
      inputSchema: inputSchema.shape,
      outputSchema: outputSchema.shape,
      annotations: {
        readOnlyHint: false, // Writes to code-analyzer.yml
        destructiveHint: false, // Does not delete anything
        openWorldHint: false, // Local file operations only
      },
    };
  }

  public async exec(input: z.infer<typeof inputSchema>): Promise<CallToolResult> {
    const validationError = validateInput(input);
    if (validationError) {
      return validationError;
    }

    const actionInput: CreateRegexCustomRuleInput = {
      regex: input.regex,
      ruleName: input.ruleName,
      description: input.description,
      violationMessage: input.violationMessage,
      tags: input.tags,
      severity: input.severity,
      workingDirectory: input.workingDirectory,
      fileExtensions: input.fileExtensions,
      regexIgnore: input.regexIgnore,
      includeMetadata: input.includeMetadata,
      engine: "regex"
    };

    const output: CreateRegexCustomRuleOutput = await this.action.exec(actionInput);

    const message = output.configPath
      ? `Regex rule created successfully. Config: ${output.configPath}.`
      : output.status;

    if (this.telemetryService && output.status === "success") {
      this.telemetryService.sendEvent(Constants.TelemetryEventName, {
        source: Constants.TelemetrySource,
        sfcaEvent: Constants.McpTelemetryEvents.CUSTOM_RULE_CREATED,
        engine: "regex",
        ruleName: input.ruleName,
        configPath: output.configPath
      });
    }

    return {
      content: [{ type: "text", text: message }],
      structuredContent: output,
      isError: output.status !== "success"
    };
  }
}

function validateInput(input: z.infer<typeof inputSchema>): CallToolResult | undefined {
  const ruleName = input.ruleName?.trim();
  if (!ruleName) {
    return buildError("ruleName is required. Provide a name for the custom rule.");
  }

  const regex = input.regex?.trim();
  if (!regex) {
    return buildError("regex is required. Provide a regex pattern like '/todo/gi'.");
  }

  if (!regex.startsWith("/") || regex.lastIndexOf("/") <= 0) {
    return buildError("regex must be in format '/pattern/flags' (e.g., '/todo/gi' or '/[0-9]+/g').");
  }

  const description = input.description?.trim();
  if (!description) {
    return buildError("description is required. Provide a short description of what the rule checks.");
  }

  const violationMessage = input.violationMessage?.trim();
  if (!violationMessage) {
    return buildError("violationMessage is required. Provide a message shown when violation is found.");
  }

  if (!input.tags || input.tags.length === 0) {
    return buildError("tags is required. Provide at least one tag (e.g., ['Custom']).");
  }

  if (input.severity === undefined || input.severity === null) {
    return buildError("severity is required. Provide a value between 1 (Critical) and 5 (Info).");
  }

  if (input.severity < 1 || input.severity > 5) {
    return buildError("severity must be between 1 (Critical) and 5 (Info).");
  }

  const workingDirectory = input.workingDirectory?.trim();
  if (!workingDirectory) {
    return buildError("workingDirectory is required. Provide a directory where files can be written.");
  }

  // Validate file extensions if provided
  if (input.fileExtensions && input.fileExtensions.length > 0) {
    for (const ext of input.fileExtensions) {
      if (!ext.startsWith(".")) {
        return buildError(`file extension must start with dot: '${ext}'. Use '.cls' not 'cls'.`);
      }
    }
  }

  return undefined;
}

function buildError(status: string): CallToolResult {
  const output = { status };
  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    structuredContent: output,
    isError: true
  };
}
