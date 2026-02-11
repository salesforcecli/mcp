import path from "node:path";
import fs from "node:fs/promises";
import { escapeXml } from "../utils.js";

// TODO: Work in progress. This action is a placeholder to wire the tool end-to-end.

export type CreateCustomRuleInput = {
  xpath: string;
  ruleName?: string;
  description?: string;
  language?: string;
  engine?: string;
  priority?: number;
  workingDirectory?: string;
};

export type CreateCustomRuleOutput = {
  status: string;
  ruleXml?: string;
  rulesetPath?: string;
  configPath?: string;
};

export interface CreateCustomRuleAction {
  exec(input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput>;
}

export class CreateCustomRuleActionImpl implements CreateCustomRuleAction {
  public async exec(input: CreateCustomRuleInput): Promise<CreateCustomRuleOutput> {
    const normalized = normalizeInput(input);
    if ("error" in normalized) {
      return { status: normalized.error };
    }

    const ruleXml = await buildRuleXml(normalized);
    const { customRulesDir, rulesetPath, configPath } = buildPaths(normalized);

    await fs.mkdir(customRulesDir, { recursive: true });
    await fs.writeFile(rulesetPath, ruleXml, "utf8");
    await upsertCodeAnalyzerConfig(configPath, rulesetPath);

    return { status: "success", ruleXml, rulesetPath, configPath };
  }
}

type NormalizedInput = {
  xpath: string;
  engine: string;
  ruleName: string;
  description: string;
  language: string;
  priority: number;
  workingDirectory: string;
};

const DEFAULT_RULE_NAME = "CustomXPathRule";
const DEFAULT_DESCRIPTION = "Generated rule from XPath";
const DEFAULT_LANGUAGE = "apex";
const DEFAULT_PRIORITY = 3;
const CUSTOM_RULES_DIR_NAME = "custom-rules";

function normalizeInput(input: CreateCustomRuleInput): NormalizedInput | { error: string } {
  const xpath = (input.xpath ?? "").trim();
  if (!xpath) {
    return { error: "xpath is required" };
  }

  const engine = (input.engine ?? "pmd").toLowerCase();
  if (engine !== "pmd") {
    return { error: `engine '${engine}' is not supported yet` };
  }

  const workingDirectory = input.workingDirectory?.trim();
  if (!workingDirectory) {
    return { error: "workingDirectory is required" };
  }

  return {
    xpath,
    engine,
    ruleName: input.ruleName?.trim() || DEFAULT_RULE_NAME,
    description: input.description?.trim() || DEFAULT_DESCRIPTION,
    language: (input.language ?? DEFAULT_LANGUAGE).toLowerCase(),
    priority: Number.isFinite(input.priority) ? (input.priority as number) : DEFAULT_PRIORITY,
    workingDirectory
  };
}

async function buildRuleXml(input: NormalizedInput): Promise<string> {
  const templatePath = new URL("../templates/pmd-ruleset.xml", import.meta.url);
  const template = await fs.readFile(templatePath, "utf8");
  return applyTemplate(template, {
    rulesetName: escapeXml(input.ruleName),
    rulesetDescription: escapeXml(input.description),
    ruleName: escapeXml(input.ruleName),
    ruleMessage: escapeXml(input.description),
    ruleDescription: escapeXml(input.description),
    documentationUrl: "",
    priority: String(input.priority),
    xpathExpression: input.xpath,
    exampleCode: ""
  });
}

function buildPaths(input: NormalizedInput): { customRulesDir: string; rulesetPath: string; configPath: string } {
  const customRulesDir = path.join(input.workingDirectory, CUSTOM_RULES_DIR_NAME);
  return {
    customRulesDir,
    rulesetPath: path.join(customRulesDir, `${input.ruleName}-pmd-rules.xml`),
    configPath: path.join(input.workingDirectory, "code-analyzer.yml")
  };
}

function applyTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

async function upsertCodeAnalyzerConfig(configPath: string, rulesetPath: string): Promise<void> {
  try {
    const existing = await fs.readFile(configPath, "utf8");
    if (existing.includes(rulesetPath)) {
      return;
    }
    const updated = addRulesetPath(existing, rulesetPath);
    await fs.writeFile(configPath, updated, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
    const templatePath = new URL("../templates/code-analyzer.yml", import.meta.url);
    const template = await fs.readFile(templatePath, "utf8");
    const content = applyTemplate(template, { rulesetPath });
    await fs.writeFile(configPath, content, "utf8");
  }
}

function addRulesetPath(configContent: string, rulesetPath: string): string {
  const lines = configContent.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "rulesets:") {
      lines.splice(i + 1, 0, `      - "${rulesetPath}"`);
      return lines.join("\n");
    }
  }
  return [
    configContent.trimEnd(),
    "",
    "engines:",
    "  pmd:",
    "    rulesets:",
    `      - "${rulesetPath}"`
  ].join("\n");
}
