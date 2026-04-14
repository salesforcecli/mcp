import {
  IRuleCreationStrategy,
  RuleCreationInput,
  ValidationResult,
  RuleCreationOutput
} from "./IRuleCreationStrategy.js";
import {
  CreateXpathCustomRuleActionImpl,
  CreateXpathCustomRuleInput
} from "../actions/create-xpath-custom-rule.js";

/**
 * Strategy for creating PMD XPath-based custom rules.
 * Rules are stored in separate XML files and referenced in code-analyzer.yml
 */
export class XPathRuleStrategy implements IRuleCreationStrategy {
  private readonly action: CreateXpathCustomRuleActionImpl;

  constructor() {
    this.action = new CreateXpathCustomRuleActionImpl();
  }

  public getSupportedEngine(): string {
    return "pmd";
  }

  public validate(input: RuleCreationInput): ValidationResult {
    const errors: string[] = [];

    // Validate xpath
    const xpath = input.xpath?.trim();
    if (!xpath) {
      const langLower = input.language?.toLowerCase() || "";
      if (langLower === "apex" || langLower === "visualforce") {
        errors.push(
          "xpath is required for PMD engine. " +
          "For Apex and Visualforce, use tool 'get_ast_nodes_to_generate_xpath' to generate the XPath."
        );
      } else {
        errors.push("xpath is required for PMD engine. Provide a valid XPath expression.");
      }
    }

    // Validate language
    if (!input.language?.trim()) {
      errors.push("language is required for PMD engine (e.g., 'apex', 'visualforce')");
    }

    // Validate priority
    if (input.priority === undefined || input.priority === null) {
      errors.push("priority is required for PMD engine (provide a value between 1 and 5)");
    } else if (input.priority < 1 || input.priority > 5) {
      errors.push("priority must be between 1 and 5");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public async execute(input: RuleCreationInput): Promise<RuleCreationOutput> {
    const actionInput: CreateXpathCustomRuleInput = {
      xpath: input.xpath!,
      ruleName: input.ruleName,
      description: input.description,
      language: input.language!,
      priority: input.priority!,
      workingDirectory: input.workingDirectory,
      engine: "pmd"
    };

    return await this.action.exec(actionInput);
  }
}
