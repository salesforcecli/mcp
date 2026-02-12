import { z } from "zod";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpTool, McpToolConfig, ReleaseState, Toolset, TelemetryService } from "@salesforce/mcp-provider-api";
import * as Constants from "../constants.js";
import {
  CreateXpathCustomRuleAction,
  CreateXpathCustomRuleActionImpl,
  CreateXpathCustomRuleInput,
  CreateXpathCustomRuleOutput
} from "../actions/create-xpath-custom-rule.js";

const DESCRIPTION: string =
  `Purpose: Create a custom rule using a provided XPath expression.
Use this tool after an XPath has been generated for a specific violation pattern.

If xpath is not provided and engine is "pmd":
- First call the tool "get_ast_nodes_to_generate_xpath" to generate the XPath.
- Then call this tool again with the generated XPath.

Inputs (required):
- xpath: The XPath expression that should match the violation.
- ruleName: Name for the custom rule.
- description: A short description/message for the rule.
- language: Language for the rule (e.g., "apex").
- engine: Engine name (e.g., "pmd").
- priority: PMD priority (1-5).
- workingDirectory: Workspace directory where the ruleset XML and code-analyzer.yml will be created (or updated).

Output:
- rulesetPath: Path to the generated custom ruleset XML.
- configPath: Path to the updated code-analyzer.yml that references the custom ruleset.`;

export const inputSchema = z.object({
  xpath: z.string().describe("XPath expression that should match the violation."),
  ruleName: z.string().describe("Name for the custom rule."),
  description: z.string().describe("Short description or message for the rule."),
  language: z.string().describe("Language for the rule (e.g., 'apex')."),
  engine: z.string().describe("Analysis engine (e.g., 'pmd')."),
  priority: z.number().int().min(1).max(5).describe("PMD priority (1-5)."),
  workingDirectory: z.string().describe("Workspace directory where code-analyzer.yml will be created (or updated).")
});
type InputArgsShape = typeof inputSchema.shape;

const outputSchema = z.object({
  status: z.string().describe(`'success' or an error message.`),
  ruleXml: z.string().optional().describe("Generated PMD ruleset XML for the custom rule."),
  rulesetPath: z.string().optional().describe("Path to the generated PMD ruleset XML."),
  configPath: z.string().optional().describe("Path to the generated code-analyzer.yml.")
});
type OutputArgsShape = typeof outputSchema.shape;

export class CreateCustomRuleMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public static readonly NAME: string = "create_custom_rule";
  private readonly action: CreateXpathCustomRuleAction;
  private readonly telemetryService?: TelemetryService;

  public constructor(
    action: CreateXpathCustomRuleAction = new CreateXpathCustomRuleActionImpl(),
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
    return CreateCustomRuleMcpTool.NAME;
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: "Create Custom Rule",
      description: DESCRIPTION,
      inputSchema: inputSchema.shape,
      outputSchema: outputSchema.shape,
      annotations: {
        readOnlyHint: true
      }
    };
  }

  public async exec(input: z.infer<typeof inputSchema>): Promise<CallToolResult> {
    const validationError = validateInput(input);
    if (validationError) {
      return validationError;
    }
    const output: CreateXpathCustomRuleOutput = await this.action.exec(input as CreateXpathCustomRuleInput);
    const message = output.rulesetPath && output.configPath
      ? `Custom rule created. Ruleset: ${output.rulesetPath}. Code Analyzer config: ${output.configPath}.`
      : output.status;
    if (this.telemetryService) {
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
    return {
      content: [{ type: "text", text: message }],
      structuredContent: output
    };
  }
}

function validateInput(input: z.infer<typeof inputSchema>): CallToolResult | undefined {
  const ruleName = input.ruleName?.trim();
  if (!ruleName) {
    return buildError("ruleName is required. Provide a name for the custom rule.");
  }

  const description = input.description?.trim();
  if (!description) {
    return buildError("description is required. Provide a short description or message for the rule.");
  }

  const language = input.language?.trim();
  if (!language) {
    return buildError("language is required. Provide a language such as 'apex'.");
  }

  const engine = input.engine?.trim();
  if (!engine) {
    return buildError("engine is required. Provide an engine such as 'pmd'.");
  }

  const xpath = input.xpath?.trim();
  if (engine.toLowerCase() === "pmd" && !xpath) {
    return buildError("xpath is required for engine 'pmd'. Provide a valid XPath expression, use tool 'get_ast_nodes_to_generate_xpath' to generate the XPath.");
  }

  if (input.priority === undefined || input.priority === null) {
    return buildError("priority is required. Provide a value between 1 and 5.");
  }

  const workingDirectory = input.workingDirectory?.trim();
  if (!workingDirectory) {
    return buildError("workingDirectory is required. Provide a directory where files can be written.");
  }

  return undefined;
}

function buildError(status: string): CallToolResult {
  const output = { status };
  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    structuredContent: output
  };
}
