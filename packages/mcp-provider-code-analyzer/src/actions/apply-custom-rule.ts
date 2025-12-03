import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {getErrorMessage} from "../utils.js";
import yaml from "js-yaml";

export type SupportedEngine = 'pmd' | 'eslint' | 'regex';

export type PmdRuleConfig = {
    engine: 'pmd'
    xpath: string
    rule_name: string
    message: string
    severity: number
    tags: string[]
    description: string
    explanation?: string
    documentationUrl?: string
    exampleCode?: string
}

export type EslintRuleConfig = {
    engine: 'eslint'
    rule_name: string
    rule_code: string  // The actual JavaScript/TypeScript code
    message: string
    severity: number
    description: string
}

export type RegexRuleConfig = {
    engine: 'regex'
    rule_name: string
    pattern: string
    message: string
    severity: number
    files: string[]
    description: string
}

export type RuleConfig = PmdRuleConfig | EslintRuleConfig | RegexRuleConfig;

export type ApplyCustomRuleInput = {
    ruleConfigJson: string
    projectRoot: string
    engine: SupportedEngine  // Required: Which engine this rule is for
}

export type ApplyCustomRuleOutput = {
    status: string
    ruleDetails?: {
        name: string
        description: string
        xpath: string
        message: string
        severity: number
        severityLabel: string
        tags: string[]
        explanation?: string
    }
    filesCreated?: Array<{
        type: string
        path: string
        relativePath: string
    }>
    filesModified?: Array<{
        type: string
        path: string
        modification: string
    }>
    testingInstructions?: {
        step_1_verify_rule_loaded: {command: string, expected: string}
        step_2_test_on_apex_classes: {command: string, expected: string}
        step_3_run_all_custom_rules: {command: string, expected: string}
    }
    nextSteps?: Array<{
        step: number
        action: string
        file?: string
        command?: string
    }>
    workflowSteps?: Array<{step: number, action: string, status: string, [key: string]: any}>
    error?: string
}

export interface ApplyCustomRuleAction {
    exec(input: ApplyCustomRuleInput): Promise<ApplyCustomRuleOutput>;
}

export class ApplyCustomRuleActionImpl implements ApplyCustomRuleAction {
    private readonly knowledgeBasePath: string;

    constructor(knowledgeBasePath?: string) {
        // In ES modules, __dirname is not available, so we use import.meta.url
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        this.knowledgeBasePath = knowledgeBasePath || path.join(currentDir, '../../knowledge-base');
    }

    async exec(input: ApplyCustomRuleInput): Promise<ApplyCustomRuleOutput> {
        try {
            const steps: Array<{step: number, action: string, status: string, [key: string]: any}> = [];

            // Step 3: Parse and validate rule configuration
            let ruleConfig: RuleConfig;
            try {
                ruleConfig = JSON.parse(input.ruleConfigJson);
            } catch (e) {
                return {
                    status: "error",
                    error: "Invalid JSON in rule_config_json",
                    workflowSteps: [{
                        step: 3,
                        action: "Parse rule configuration",
                        status: "failed",
                        details: getErrorMessage(e),
                        received: input.ruleConfigJson.substring(0, 200)
                    }]
                };
            }

            // Validate engine matches
            if (ruleConfig.engine !== input.engine) {
                return {
                    status: "error",
                    error: `Engine mismatch: expected '${input.engine}' but rule config has '${ruleConfig.engine}'`,
                    workflowSteps: [{
                        step: 3,
                        action: "Validate engine",
                        status: "failed",
                        expectedEngine: input.engine,
                        receivedEngine: ruleConfig.engine
                    }]
                };
            }

            // Validate required fields based on engine
            const missingFields = this.validateRuleConfig(ruleConfig);
            
            if (missingFields.length > 0) {
                return {
                    status: "error",
                    error: "Missing required fields in rule configuration",
                    workflowSteps: [{
                        step: 3,
                        action: "Validate rule configuration",
                        status: "failed",
                        missingFields,
                        engine: input.engine,
                        receivedConfig: ruleConfig
                    }]
                };
            }

            // Validate severity
            if (ruleConfig.severity < 1 || ruleConfig.severity > 5) {
                return {
                    status: "error",
                    error: "Invalid severity value",
                    workflowSteps: [{
                        step: 3,
                        action: "Validate severity",
                        status: "failed",
                        severityReceived: ruleConfig.severity,
                        validRange: "1-5 (1=Critical, 2=High, 3=Moderate, 4=Low, 5=Info)"
                    }]
                };
            }

            steps.push({
                step: 3,
                action: "Validate LLM-generated rule configuration",
                status: "success",
                ruleName: ruleConfig.rule_name,
                engine: input.engine,
                severity: ruleConfig.severity
            });

            // Step 4: Ensure code-analyzer.yml exists
            const configResult = this.ensureCodeAnalyzerConfig(input.projectRoot);
            
            if (configResult.error) {
                return {
                    status: "error",
                    error: configResult.error,
                    workflowSteps: steps.concat([{
                        step: 4,
                        action: "Create/verify code-analyzer.yml",
                        status: "failed",
                        projectRoot: input.projectRoot,
                        suggestion: "Install Salesforce Code Analyzer: sf plugins install @salesforce/plugin-code-analyzer"
                    }])
                };
            }

            steps.push({
                step: 4,
                action: "Create/verify code-analyzer.yml",
                status: "success",
                created: configResult.created,
                configPath: configResult.configPath
            });

            // Step 5: Create custom-rules directory
            const customRulesDir = path.join(input.projectRoot, 'custom-rules');
            let createdDir = false;
            
            if (!fs.existsSync(customRulesDir)) {
                fs.mkdirSync(customRulesDir, {recursive: true});
                createdDir = true;
            }

            steps.push({
                step: 5,
                action: "Create custom-rules directory",
                status: "success",
                created: createdDir,
                directoryPath: customRulesDir
            });

            // Step 6: Generate rule file based on engine
            let ruleFilename: string;
            let ruleFilePath: string;
            let fileResult: {success: boolean, filePath?: string, error?: string};

            if (input.engine === 'pmd') {
                ruleFilename = `${ruleConfig.rule_name.toLowerCase().replace(/\s+/g, '-')}-rules.xml`;
                ruleFilePath = path.join(customRulesDir, ruleFilename);
                fileResult = this.createPmdRulesetXml(ruleConfig as PmdRuleConfig, ruleFilePath);
            } else if (input.engine === 'eslint') {
                ruleFilename = `${ruleConfig.rule_name.toLowerCase().replace(/\s+/g, '-')}.js`;
                ruleFilePath = path.join(customRulesDir, ruleFilename);
                fileResult = this.createEslintRuleFile(ruleConfig as EslintRuleConfig, ruleFilePath);
            } else if (input.engine === 'regex') {
                // Regex rules are stored directly in code-analyzer.yml, no file needed
                ruleFilename = '';
                ruleFilePath = '';
                fileResult = {success: true};
            } else {
                return {
                    status: "error",
                    error: `Unsupported engine: ${input.engine}`,
                    workflowSteps: steps
                };
            }

            const xmlResult = fileResult;

            if (!xmlResult.success) {
                return {
                    status: "error",
                    error: xmlResult.error,
                    workflowSteps: steps.concat([{
                        step: 6,
                        action: "Generate PMD ruleset XML file",
                        status: "failed"
                    }])
                };
            }

            steps.push({
                step: 6,
                action: `Generate ${input.engine.toUpperCase()} rule file`,
                status: "success",
                filePath: ruleFilePath || 'N/A (stored in YAML)',
                relativePath: ruleFilename ? `custom-rules/${ruleFilename}` : 'N/A'
            });

            // Step 7: Update code-analyzer.yml
            const updateResult = this.updateCodeAnalyzerConfig(
                configResult.configPath!,
                `custom-rules/${ruleFilename}`
            );

            steps.push({
                step: 7,
                action: "Add custom ruleset to code-analyzer.yml",
                status: updateResult.success ? "success" : "failed",
                message: updateResult.message
            });

            // Build final response
            const severityLabels: Record<number, string> = {
                1: "Critical",
                2: "High",
                3: "Moderate",
                4: "Low",
                5: "Info"
            };

            // Build rule details based on engine
            const ruleDetails: any = {
                name: ruleConfig.rule_name,
                description: ruleConfig.description,
                message: ruleConfig.message,
                severity: ruleConfig.severity,
                severityLabel: severityLabels[ruleConfig.severity]
            };

            // Add engine-specific details
            if (ruleConfig.engine === 'pmd') {
                const pmdConfig = ruleConfig as PmdRuleConfig;
                ruleDetails.xpath = pmdConfig.xpath;
                ruleDetails.tags = pmdConfig.tags;
                ruleDetails.explanation = pmdConfig.explanation;
            } else if (ruleConfig.engine === 'eslint') {
                const eslintConfig = ruleConfig as EslintRuleConfig;
                ruleDetails.ruleCode = eslintConfig.rule_code;
            } else if (ruleConfig.engine === 'regex') {
                const regexConfig = ruleConfig as RegexRuleConfig;
                ruleDetails.pattern = regexConfig.pattern;
                ruleDetails.files = regexConfig.files;
            }

            const filesCreated = ruleFilePath ? [{
                type: `${input.engine.toUpperCase()} Rule File`,
                path: ruleFilePath,
                relativePath: `custom-rules/${ruleFilename}`
            }] : [];

            return {
                status: "completed",
                ruleDetails,
                filesCreated,
                filesModified: [{
                    type: "Code Analyzer Configuration",
                    path: configResult.configPath!,
                    modification: `Added 'custom-rules/${ruleFilename}' to engines.pmd.custom_rulesets array`
                }],
                testingInstructions: {
                    step_1_verify_rule_loaded: {
                        command: `sf code-analyzer rules --rule-selector pmd:${ruleConfig.rule_name}`,
                        expected: `Should show the custom rule '${ruleConfig.rule_name}' in the output`
                    },
                    step_2_test_on_apex_classes: {
                        command: `sf code-analyzer run --target force-app/main/default/classes/ --rule-selector pmd:${ruleConfig.rule_name}`,
                        expected: "Should scan Apex classes and report any violations"
                    },
                    step_3_run_all_custom_rules: {
                        command: "sf code-analyzer run --target force-app/ --rule-selector pmd:Custom",
                        expected: "Should run all custom PMD rules"
                    }
                },
                nextSteps: [
                    {
                        step: 1,
                        action: `Review the generated ${input.engine.toUpperCase()} rule file`,
                        file: ruleFilePath || configResult.configPath
                    },
                    {
                        step: 2,
                        action: "Verify the rule is loaded",
                        command: `sf code-analyzer rules --rule-selector pmd:${ruleConfig.rule_name}`
                    },
                    {
                        step: 3,
                        action: "Test the rule on your Apex code",
                        command: `sf code-analyzer run --target force-app/main/default/classes/ --rule-selector pmd:${ruleConfig.rule_name}`
                    },
                    {
                        step: 4,
                        action: "Adjust rule severity or tags if needed",
                        file: configResult.configPath
                    }
                ],
                workflowSteps: steps
            };

        } catch (e: unknown) {
            return {
                status: "error",
                error: `Failed to create custom rule files: ${getErrorMessage(e)}`
            };
        }
    }

    private ensureCodeAnalyzerConfig(projectRoot: string): {
        configPath?: string
        created: boolean
        error?: string
        message?: string
    } {
        const configPath = path.join(projectRoot, 'code-analyzer.yml');

        if (fs.existsSync(configPath)) {
            return {
                configPath,
                created: false,
                message: "Found existing code-analyzer.yml"
            };
        }

        // Create minimal config manually
        try {
            const minimalConfig = `# Code Analyzer Configuration
# Auto-generated by MCP Custom Rule Generator

engines:
  pmd:
    disable_engine: false
    custom_rulesets: []
  flow:
    disable_engine: true  # Disabled - requires Python 3.10+
`;
            fs.writeFileSync(configPath, minimalConfig, 'utf-8');

            return {
                configPath,
                created: true,
                message: "Created minimal code-analyzer.yml (Flow engine disabled due to missing Python 3.10+)"
            };
        } catch (e) {
            return {
                created: false,
                error: `Failed to create code-analyzer.yml: ${getErrorMessage(e)}`,
                message: "Could not create configuration file"
            };
        }
    }

    private createPmdRulesetXml(ruleConfig: PmdRuleConfig, outputPath: string): {
        success: boolean
        filePath?: string
        error?: string
    } {
        try {
            const templatePath = path.join(this.knowledgeBasePath, 'custom-rule-generator', 'pmd', 'templates', 'pmd-ruleset-template.xml');
            
            if (!fs.existsSync(templatePath)) {
                return {
                    success: false,
                    error: `Template file not found: ${templatePath}`
                };
            }

            let template = fs.readFileSync(templatePath, 'utf-8');

            // Replace placeholders
            template = template.replace(/\{\{rulesetName\}\}/g, `Custom ${ruleConfig.rule_name} Rules`);
            template = template.replace(/\{\{rulesetDescription\}\}/g, 
                `Custom rules generated via MCP tool. ${ruleConfig.description}`);
            template = template.replace(/\{\{ruleName\}\}/g, ruleConfig.rule_name);
            template = template.replace(/\{\{ruleMessage\}\}/g, ruleConfig.message);
            template = template.replace(/\{\{ruleDescription\}\}/g, ruleConfig.description);
            template = template.replace(/\{\{priority\}\}/g, String(ruleConfig.severity));
            template = template.replace(/\{\{xpathExpression\}\}/g, ruleConfig.xpath);
            template = template.replace(/\{\{documentationUrl\}\}/g, 
                ruleConfig.documentationUrl || 'https://your-org.com/standards');
            template = template.replace(/\{\{exampleCode\}\}/g, 
                ruleConfig.exampleCode || '// See rule description for examples');

            fs.writeFileSync(outputPath, template, 'utf-8');

            return {
                success: true,
                filePath: outputPath
            };
        } catch (e) {
            return {
                success: false,
                error: `Failed to create ruleset XML: ${getErrorMessage(e)}`
            };
        }
    }

    private validateRuleConfig(ruleConfig: RuleConfig): string[] {
        const missingFields: string[] = [];

        // Common fields
        if (!ruleConfig.rule_name) missingFields.push('rule_name');
        if (!ruleConfig.message) missingFields.push('message');
        if (ruleConfig.severity === undefined) missingFields.push('severity');
        if (!ruleConfig.description) missingFields.push('description');

        // Engine-specific fields
        if (ruleConfig.engine === 'pmd') {
            const pmdConfig = ruleConfig as PmdRuleConfig;
            if (!pmdConfig.xpath) missingFields.push('xpath');
            if (!pmdConfig.tags) missingFields.push('tags');
        } else if (ruleConfig.engine === 'eslint') {
            const eslintConfig = ruleConfig as EslintRuleConfig;
            if (!eslintConfig.rule_code) missingFields.push('rule_code');
        } else if (ruleConfig.engine === 'regex') {
            const regexConfig = ruleConfig as RegexRuleConfig;
            if (!regexConfig.pattern) missingFields.push('pattern');
            if (!regexConfig.files) missingFields.push('files');
        }

        return missingFields;
    }

    private createEslintRuleFile(ruleConfig: EslintRuleConfig, outputPath: string): {
        success: boolean
        filePath?: string
        error?: string
    } {
        try {
            // Create ESLint rule file
            const ruleContent = `/**
 * ${ruleConfig.description}
 * Generated by Salesforce Code Analyzer MCP Tool
 */

${ruleConfig.rule_code}
`;
            fs.writeFileSync(outputPath, ruleContent, 'utf-8');

            return {
                success: true,
                filePath: outputPath
            };
        } catch (e) {
            return {
                success: false,
                error: `Failed to create ESLint rule file: ${getErrorMessage(e)}`
            };
        }
    }

    private updateCodeAnalyzerConfig(configPath: string, ruleXmlRelativePath: string): {
        success: boolean
        message: string
        error?: string
    } {
        try {
            const configContent = fs.readFileSync(configPath, 'utf-8');
            let config: any;

            try {
                config = yaml.load(configContent) || {};
            } catch {
                config = {};
            }

            // Ensure structure exists
            if (!config.engines) config.engines = {};
            if (!config.engines.pmd) config.engines.pmd = {};
            if (!config.engines.pmd.custom_rulesets) config.engines.pmd.custom_rulesets = [];

            // Add custom ruleset if not already present
            if (!config.engines.pmd.custom_rulesets.includes(ruleXmlRelativePath)) {
                config.engines.pmd.custom_rulesets.push(ruleXmlRelativePath);

                const updatedContent = yaml.dump(config, {noRefs: true, sortKeys: false});
                fs.writeFileSync(configPath, updatedContent, 'utf-8');

                return {
                    success: true,
                    message: `Added ${ruleXmlRelativePath} to code-analyzer.yml`
                };
            } else {
                return {
                    success: true,
                    message: `Ruleset ${ruleXmlRelativePath} already exists in config`
                };
            }
        } catch (e) {
            return {
                success: false,
                message: `Failed to update config: ${getErrorMessage(e)}`,
                error: getErrorMessage(e)
            };
        }
    }
}

