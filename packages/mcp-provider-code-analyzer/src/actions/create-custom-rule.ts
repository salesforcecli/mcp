import path from "node:path";
import fs from "node:fs/promises";

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
    const xpath = (input.xpath ?? "").trim();
    if (!xpath) {
      return { status: "xpath is required" };
    }

    const engine = (input.engine ?? "pmd").toLowerCase();
    if (engine !== "pmd") {
      return { status: `engine '${engine}' is not supported yet` };
    }

    const ruleName = input.ruleName?.trim() || "CustomXPathRule";
    const description = input.description?.trim() || "Generated rule from XPath";
    const language = (input.language ?? "apex").toLowerCase();
    const priority = Number.isFinite(input.priority) ? input.priority : 3;

    const ruleXml = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<ruleset name="${escapeXml(ruleName)}" xmlns="http://pmd.sourceforge.net/ruleset/2.0.0"`,
      `    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"`,
      `    xsi:schemaLocation="http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.github.io/pmd-7.0.0/ruleset_xml_schema.xsd">`,
      `  <description>${escapeXml(description)}</description>`,
      `  <rule name="${escapeXml(ruleName)}" language="${escapeXml(language)}"`,
      `        message="${escapeXml(description)}" class="net.sourceforge.pmd.lang.rule.XPathRule">`,
      `    <priority>${priority}</priority>`,
      `    <properties>`,
      `      <property name="xpath">`,
      `        <value><![CDATA[${xpath}]]></value>`,
      `      </property>`,
      `    </properties>`,
      `  </rule>`,
      `</ruleset>`
    ].join("\n");

    const workingDirectory = input.workingDirectory?.trim();
    if (!workingDirectory) {
      return { status: "workingDirectory is required" };
    }

    const rulesetPath = path.join(workingDirectory, "custom-pmd-rules.xml");
    const configPath = path.join(workingDirectory, "code-analyzer.yml");

    await fs.mkdir(workingDirectory, { recursive: true });
    await fs.writeFile(rulesetPath, ruleXml, "utf8");
    await fs.writeFile(
      configPath,
      [
        "engines:",
        "  pmd:",
        "    rulesets:",
        `      - ${rulesetPath}`
      ].join("\n"),
      "utf8"
    );

    return { status: "success", ruleXml, rulesetPath, configPath };
  }
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}
