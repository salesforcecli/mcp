import {
  IRuleCreationStrategy,
  RuleCreationInput,
  ValidationResult,
  RuleCreationOutput
} from "./IRuleCreationStrategy.js";
import {
  CreateRegexCustomRuleActionImpl,
  CreateRegexCustomRuleInput
} from "../actions/create-regex-custom-rule.js";

/**
 * Strategy for creating Regex engine custom rules.
 * Rules are added directly to code-analyzer.yml under engines.regex.custom_rules
 */
export class RegexRuleStrategy implements IRuleCreationStrategy {
  private readonly action: CreateRegexCustomRuleActionImpl;

  constructor() {
    this.action = new CreateRegexCustomRuleActionImpl();
  }

  public getSupportedEngine(): string {
    return "regex";
  }

  public validate(input: RuleCreationInput): ValidationResult {
    const errors: string[] = [];

    // Validate regex pattern
    const regex = input.regex?.trim();
    if (!regex) {
      errors.push("regex is required for regex engine");
    } else if (!regex.startsWith("/") || regex.lastIndexOf("/") <= 0) {
      errors.push("regex must be in format '/pattern/flags' (e.g., '/todo/gi')");
    }

    // Validate violation message
    if (!input.violationMessage?.trim()) {
      errors.push("violationMessage is required for regex engine");
    }

    // Validate tags
    if (!input.tags || input.tags.length === 0) {
      errors.push("tags is required for regex engine (provide at least one tag)");
    }

    // Validate severity
    if (input.severity === undefined || input.severity === null) {
      errors.push("severity is required for regex engine");
    } else if (input.severity < 1 || input.severity > 5) {
      errors.push("severity must be between 1 (Critical) and 5 (Info)");
    }

    // Validate file extensions format if provided
    if (input.fileExtensions && input.fileExtensions.length > 0) {
      for (const ext of input.fileExtensions) {
        if (!ext.startsWith(".")) {
          errors.push(`file extension must start with dot: '${ext}' (use '.cls' not 'cls')`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public async execute(input: RuleCreationInput): Promise<RuleCreationOutput> {
    const actionInput: CreateRegexCustomRuleInput = {
      regex: input.regex!,
      ruleName: input.ruleName,
      description: input.description,
      violationMessage: input.violationMessage!,
      tags: input.tags!,
      severity: input.severity!,
      workingDirectory: input.workingDirectory,
      fileExtensions: input.fileExtensions,
      regexIgnore: input.regexIgnore,
      includeMetadata: input.includeMetadata,
      engine: "regex"
    };

    return await this.action.exec(actionInput);
  }
}
