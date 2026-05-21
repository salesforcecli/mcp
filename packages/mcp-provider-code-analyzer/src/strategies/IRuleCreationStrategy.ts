// Interface for rule creation strategies supporting different engines

export type RuleCreationInput = {
  engine: string;
  ruleName: string;
  description: string;
  workingDirectory: string;

  // PMD/XPath specific fields
  xpath?: string;
  language?: string;
  priority?: number;

  // Regex specific fields
  regex?: string;
  violationMessage?: string;
  tags?: string[];
  severity?: number;
  fileExtensions?: string[];
  regexIgnore?: string;
  includeMetadata?: boolean;
};

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};

export type RuleCreationOutput = {
  status: string;
  configPath?: string;
  rulesetPath?: string;  // PMD only - path to XML file
  ruleYaml?: string;     // Regex only - generated YAML
  ruleXml?: string;      // PMD only - generated XML content
};

export interface IRuleCreationStrategy {
  /**
   * Validate engine-specific inputs
   */
  validate(input: RuleCreationInput): ValidationResult;

  /**
   * Execute rule creation
   */
  execute(input: RuleCreationInput): Promise<RuleCreationOutput>;

  /**
   * Get the engine name this strategy supports
   */
  getSupportedEngine(): string;
}
