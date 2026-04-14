import path from "node:path";
import fs from "node:fs/promises";
import fssync from "node:fs";

// Creates Regex custom rules directly in code-analyzer.yml/yaml.
// Unlike PMD which uses separate XML files, Regex rules are defined inline in the config.

export type CreateRegexCustomRuleInput = {
  regex: string;
  ruleName?: string;
  description?: string;
  violationMessage?: string;
  tags?: string[];
  severity?: number;
  fileExtensions?: string[];
  regexIgnore?: string;
  includeMetadata?: boolean;
  engine?: string;
  workingDirectory?: string;
};

export type CreateRegexCustomRuleOutput = {
  status: string;
  ruleYaml?: string;
  configPath?: string;
};

export interface CreateRegexCustomRuleAction {
  exec(input: CreateRegexCustomRuleInput): Promise<CreateRegexCustomRuleOutput>;
}

export class CreateRegexCustomRuleActionImpl implements CreateRegexCustomRuleAction {
  public async exec(input: CreateRegexCustomRuleInput): Promise<CreateRegexCustomRuleOutput> {
    const normalized = normalizeInput(input);
    if ("error" in normalized) {
      return { status: normalized.error };
    }

    const configPath = findOrCreateConfigPath(normalized.workingDirectory);
    const ruleYaml = buildRegexRuleYaml(normalized);

    await upsertRegexRuleInConfig(configPath, normalized.ruleName, ruleYaml);

    return {
      status: "success",
      ruleYaml,
      configPath
    };
  }
}

type NormalizedInput = {
  regex: string;
  engine: string;
  ruleName: string;
  description: string;
  violationMessage: string;
  tags: string[];
  severity: number;
  fileExtensions?: string[];
  regexIgnore?: string;
  includeMetadata?: boolean;
  workingDirectory: string;
};

const DEFAULT_RULE_NAME = "CustomRegexRule";
const DEFAULT_DESCRIPTION = "Generated regex rule";
const DEFAULT_VIOLATION_MESSAGE = "Pattern matched";
const DEFAULT_TAGS = ["Custom"];
const DEFAULT_SEVERITY = 3; // Moderate

function normalizeInput(input: CreateRegexCustomRuleInput): NormalizedInput | { error: string } {
  const regex = (input.regex ?? "").trim();
  if (!regex) {
    return { error: "regex is required" };
  }

  // Validate regex format - should be like "/pattern/flags"
  if (!regex.startsWith("/") || regex.lastIndexOf("/") <= 0) {
    return { error: "regex must be in format '/pattern/flags' (e.g., '/todo/gi')" };
  }

  const engine = (input.engine ?? "regex").toLowerCase();
  if (engine !== "regex") {
    return { error: `engine '${engine}' is not supported by this action` };
  }

  const workingDirectory = input.workingDirectory?.trim();
  if (!workingDirectory) {
    return { error: "workingDirectory is required" };
  }

  const ruleName = input.ruleName?.trim() || DEFAULT_RULE_NAME;
  const description = input.description?.trim() || DEFAULT_DESCRIPTION;
  const violationMessage = input.violationMessage?.trim() || DEFAULT_VIOLATION_MESSAGE;
  const tags = input.tags && input.tags.length > 0 ? input.tags : DEFAULT_TAGS;
  const severity = Number.isFinite(input.severity) ? (input.severity as number) : DEFAULT_SEVERITY;

  // Validate severity is 1-5
  if (severity < 1 || severity > 5) {
    return { error: "severity must be between 1 (Critical) and 5 (Info)" };
  }

  // Validate file extensions format if provided
  const fileExtensions = input.fileExtensions;
  if (fileExtensions && fileExtensions.length > 0) {
    for (const ext of fileExtensions) {
      if (!ext.startsWith(".")) {
        return { error: `file extension must start with dot: '${ext}'` };
      }
    }
  }

  return {
    regex,
    engine,
    ruleName,
    description,
    violationMessage,
    tags,
    severity,
    fileExtensions,
    regexIgnore: input.regexIgnore?.trim(),
    includeMetadata: input.includeMetadata,
    workingDirectory
  };
}

function buildRegexRuleYaml(input: NormalizedInput): string {
  const lines: string[] = [];

  lines.push(`      ${input.ruleName}:`);
  lines.push(`        regex: "${input.regex}"`);

  if (input.regexIgnore) {
    lines.push(`        regex_ignore: "${input.regexIgnore}"`);
  }

  if (input.fileExtensions && input.fileExtensions.length > 0) {
    lines.push(`        file_extensions:`);
    input.fileExtensions.forEach(ext => {
      lines.push(`          - "${ext}"`);
    });
  }

  lines.push(`        description: "${escapeYamlString(input.description)}"`);
  lines.push(`        violation_message: "${escapeYamlString(input.violationMessage)}"`);

  lines.push(`        tags:`);
  input.tags.forEach(tag => {
    lines.push(`          - "${tag}"`);
  });

  lines.push(`        severity: ${input.severity}`);

  if (input.includeMetadata !== undefined) {
    lines.push(`        include_metadata: ${input.includeMetadata}`);
  }

  return lines.join("\n");
}

function escapeYamlString(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

/**
 * Finds existing code-analyzer config file or returns default path for creating new one.
 * Priority: code-analyzer.yaml > code-analyzer.yml (matches Code Analyzer Core behavior)
 */
function findOrCreateConfigPath(workingDirectory: string): string {
  const yamlPath = path.join(workingDirectory, "code-analyzer.yaml");
  const ymlPath = path.join(workingDirectory, "code-analyzer.yml");

  if (fssync.existsSync(yamlPath)) {
    return yamlPath;
  }
  if (fssync.existsSync(ymlPath)) {
    return ymlPath;
  }

  // If neither exists, default to .yml for creating new file
  return ymlPath;
}

async function upsertRegexRuleInConfig(
  configPath: string,
  ruleName: string,
  ruleYaml: string
): Promise<void> {
  const existing = await readConfigIfExists(configPath);

  if (!existing) {
    // Create new config file with regex engine and rule
    await writeNewConfigWithRegexRule(configPath, ruleYaml);
    return;
  }

  // Check if rule already exists
  if (ruleAlreadyExists(existing, ruleName)) {
    throw new Error(`Rule '${ruleName}' already exists in config. Please choose a different name or remove the existing rule.`);
  }

  // Update existing config
  const updated = addRegexRuleToConfig(existing, ruleYaml);
  await fs.writeFile(configPath, updated, "utf8");
}

function ruleAlreadyExists(configContent: string, ruleName: string): boolean {
  // Simple check: look for the rule name pattern under regex custom_rules section
  const lines = configContent.split(/\r?\n/);
  let inRegexCustomRules = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track if we're in the regex.custom_rules section
    if (trimmed === "regex:" || trimmed.startsWith("regex:")) {
      inRegexCustomRules = true;
      continue;
    }

    // If we're in regex section and find another engine, we've left the section
    if (inRegexCustomRules && line.match(/^\s{2}\w+:/) && !trimmed.startsWith("custom_rules")) {
      inRegexCustomRules = false;
    }

    // Check for rule name
    if (inRegexCustomRules && trimmed === `${ruleName}:`) {
      return true;
    }
  }

  return false;
}

function addRegexRuleToConfig(configContent: string, ruleYaml: string): string {
  const lines = configContent.split(/\r?\n/);
  const indices = findRegexCustomRulesIndices(lines);

  // Case 1: engines.regex.custom_rules exists - add rule after custom_rules line
  if (indices.customRulesLineIndex !== -1) {
    lines.splice(indices.customRulesLineIndex + 1, 0, ruleYaml);
    return lines.join("\n");
  }

  // Case 2: engines.regex exists but no custom_rules - add custom_rules section
  if (indices.regexLineIndex !== -1) {
    lines.splice(indices.regexLineIndex + 1, 0, "    custom_rules:", ruleYaml);
    return lines.join("\n");
  }

  // Case 3: engines exists but no regex - add regex section
  if (indices.enginesLineIndex !== -1) {
    lines.splice(indices.enginesLineIndex + 1, 0, "  regex:", "    custom_rules:", ruleYaml);
    return lines.join("\n");
  }

  // Case 4: No engines section - append at end
  return appendRegexEngineBlock(configContent, ruleYaml);
}

function findRegexCustomRulesIndices(lines: string[]): {
  enginesLineIndex: number;
  regexLineIndex: number;
  customRulesLineIndex: number;
} {
  let enginesLineIndex = -1;
  let regexLineIndex = -1;
  let customRulesLineIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed === "engines:") {
      enginesLineIndex = i;
      continue;
    }

    if (trimmed === "regex:" && enginesLineIndex !== -1) {
      regexLineIndex = i;
      continue;
    }

    if (trimmed === "custom_rules:" && regexLineIndex !== -1) {
      customRulesLineIndex = i;
      break;
    }
  }

  return { enginesLineIndex, regexLineIndex, customRulesLineIndex };
}

function appendRegexEngineBlock(configContent: string, ruleYaml: string): string {
  return [
    configContent.trimEnd(),
    "",
    "engines:",
    "  regex:",
    "    custom_rules:",
    ruleYaml
  ].join("\n");
}

async function writeNewConfigWithRegexRule(configPath: string, ruleYaml: string): Promise<void> {
  const content = [
    "engines:",
    "  regex:",
    "    custom_rules:",
    ruleYaml
  ].join("\n");

  await fs.writeFile(configPath, content, "utf8");
}

async function readConfigIfExists(configPath: string): Promise<string | null> {
  try {
    return await fs.readFile(configPath, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return null;
    }
    throw error;
  }
}
