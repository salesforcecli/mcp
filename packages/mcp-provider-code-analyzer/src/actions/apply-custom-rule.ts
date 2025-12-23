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
    description: string
    tags?: string[]
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
    ruleConfigJson: string[]  // Array of JSON strings, one per rule
    projectRoot: string
}

export type ApplyCustomRuleOutput = {
    status: string
    rulesProcessed?: number
    rulesSucceeded?: number
    rulesFailed?: number
    ruleDetails?: Array<{
        name: string
        description: string
    }>
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
    errors?: Array<{ruleName?: string, error: string}>
    error?: string
    testingInstructions?: string
}

export interface ApplyCustomRuleAction {
    exec(input: ApplyCustomRuleInput): Promise<ApplyCustomRuleOutput>;
}

export class ApplyCustomRuleActionImpl implements ApplyCustomRuleAction {
    private readonly knowledgeBasePath: string;

    constructor(knowledgeBasePath?: string) {
        // In ES modules, __dirname is not available, so we use import.meta.url
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        this.knowledgeBasePath = knowledgeBasePath || path.join(currentDir, '../resources/custom-rules');
    }

    async exec(input: ApplyCustomRuleInput): Promise<ApplyCustomRuleOutput> {
        try {
            const errors: Array<{ruleName?: string, error: string}> = [];
            const allRuleDetails: Array<any> = [];
            const allFilesCreated: Array<{type: string, path: string, relativePath: string}> = [];
            const rulesetPaths: string[] = [];

            // Step 3: Parse and validate all rule configurations
            const ruleConfigs: RuleConfig[] = [];
            
            for (let i = 0; i < input.ruleConfigJson.length; i++) {
                const ruleJson = input.ruleConfigJson[i];
                let ruleConfig: RuleConfig;
                
                try {
                    // First, try parsing as-is
                    ruleConfig = JSON.parse(ruleJson);
                } catch (firstError) {
                    // If that fails, try escaping unescaped control characters
                    // This handles cases where JSON strings contain literal newlines/tabs
                    try {
                        let normalizedJson = ruleJson;
                        // Simple approach: protect already-escaped sequences, escape literals, then restore
                        // Replace escaped sequences with temporary markers
                        normalizedJson = normalizedJson.replace(/\\n/g, '__TEMP_NEWLINE__');
                        normalizedJson = normalizedJson.replace(/\\t/g, '__TEMP_TAB__');
                        normalizedJson = normalizedJson.replace(/\\r/g, '__TEMP_RETURN__');
                        // Now escape any remaining literal control characters
                        normalizedJson = normalizedJson.replace(/\n/g, '\\n');
                        normalizedJson = normalizedJson.replace(/\t/g, '\\t');
                        normalizedJson = normalizedJson.replace(/\r/g, '\\r');
                        // Restore the protected sequences
                        normalizedJson = normalizedJson.replace(/__TEMP_NEWLINE__/g, '\\n');
                        normalizedJson = normalizedJson.replace(/__TEMP_TAB__/g, '\\t');
                        normalizedJson = normalizedJson.replace(/__TEMP_RETURN__/g, '\\r');
                        ruleConfig = JSON.parse(normalizedJson);
                    } catch (secondError) {
                        // If that fails, try parsing as double-encoded JSON
                        // (JSON string containing another JSON string)
                        try {
                            const decoded = JSON.parse(ruleJson);
                            if (typeof decoded === 'string') {
                                ruleConfig = JSON.parse(decoded);
                            } else {
                                ruleConfig = decoded;
                            }
                        } catch (thirdError) {
                            // If all attempts fail, report the error
                            errors.push({
                                ruleName: `Rule ${i + 1}`,
                                error: `Invalid JSON in rule_config_json[${i}]: ${getErrorMessage(firstError)}`
                            });
                            continue;
                        }
                    }
                }

                // Engine is inferred from each rule's 'engine' field

                // Validate required fields based on engine
                const missingFields = this.validateRuleConfig(ruleConfig);
                
                if (missingFields.length > 0) {
                    errors.push({
                        ruleName: ruleConfig.rule_name || `Rule ${i + 1}`,
                        error: `Missing required fields: ${missingFields.join(', ')}`
                    });
                    continue;
                }

                // Validate severity
                if (ruleConfig.severity < 1 || ruleConfig.severity > 5) {
                    errors.push({
                        ruleName: ruleConfig.rule_name || `Rule ${i + 1}`,
                        error: `Invalid severity value: ${ruleConfig.severity} (must be 1-5)`
                    });
                    continue;
                }

                ruleConfigs.push(ruleConfig);
            }

            if (ruleConfigs.length === 0) {
                return {
                    status: "error",
                    error: "No valid rule configurations found",
                    errors
                };
            }


            // Step 4: Ensure code-analyzer.yml exists
            const configResult = this.ensureCodeAnalyzerConfig(input.projectRoot);
            
            if (configResult.error) {
                return {
                    status: "error",
                    error: configResult.error
                };
            }


            // Step 5: Create custom-rules directory
            const customRulesDir = path.join(input.projectRoot, 'custom-rules');
            let createdDir = false;
            
            if (!fs.existsSync(customRulesDir)) {
                fs.mkdirSync(customRulesDir, {recursive: true});
                createdDir = true;
            }


            // Step 6: Generate rule files for all valid rules

            for (const ruleConfig of ruleConfigs) {
                let ruleFilename: string;
                let ruleFilePath: string;
                let fileResult: {success: boolean, filePath?: string, error?: string};

                // Use ruleConfig.engine (from rule config) instead of input.engine
                const ruleEngine = ruleConfig.engine;

                if (ruleEngine === 'pmd') {
                    ruleFilename = `${ruleConfig.rule_name.toLowerCase().replace(/\s+/g, '-')}-rules.xml`;
                    ruleFilePath = path.join(customRulesDir, ruleFilename);
                    fileResult = this.createPmdRulesetXml(ruleConfig as PmdRuleConfig, ruleFilePath);
                } else {
                    // TypeScript thinks this is unreachable, but we handle it defensively
                    const ruleName = (ruleConfig as RuleConfig).rule_name || 'unknown';
                    errors.push({
                        ruleName,
                        error: `Unsupported engine: ${ruleEngine}`
                    });
                    continue;
                }

                if (!fileResult.success) {
                    errors.push({
                        ruleName: ruleConfig.rule_name,
                        error: fileResult.error || 'Failed to create rule file'
                    });
                    continue;
                }

                if (ruleFilePath) {
                    allFilesCreated.push({
                        type: `${ruleEngine.toUpperCase()} Rule File`,
                        path: ruleFilePath,
                        relativePath: `custom-rules/${ruleFilename}`
                    });
                    rulesetPaths.push(`custom-rules/${ruleFilename}`);
                }

                // Build rule details (only name and description)
                const ruleDetails = {
                    name: ruleConfig.rule_name,
                    description: ruleConfig.description
                };

                allRuleDetails.push(ruleDetails);
            }

            if (allRuleDetails.length === 0) {
                return {
                    status: "error",
                    error: "Failed to create any rule files",
                    errors
                };
            }

            // Group rulesets by engine for config updates
            const rulesetsByEngine: Record<string, string[]> = {};
            let rulesetIndex = 0;
            for (const ruleConfig of ruleConfigs) {
                const ruleEngine = ruleConfig.engine;
                if (rulesetIndex < rulesetPaths.length) {
                    if (!rulesetsByEngine[ruleEngine]) {
                        rulesetsByEngine[ruleEngine] = [];
                    }
                    rulesetsByEngine[ruleEngine].push(rulesetPaths[rulesetIndex]);
                    rulesetIndex++;
                }
            }



            // Step 7: Update code-analyzer.yml with all rulesets (grouped by engine)
            const configUpdateMessages: string[] = [];
            for (const [engine, paths] of Object.entries(rulesetsByEngine)) {
                const updateResult = this.updateCodeAnalyzerConfigMultiple(
                    configResult.configPath!,
                    paths,
                    engine as SupportedEngine
                );
                if (updateResult.success) {
                    configUpdateMessages.push(updateResult.message);
                } else {
                    configUpdateMessages.push(`Failed for ${engine}: ${updateResult.message}`);
                }
            }
            const updateResult = {
                success: configUpdateMessages.every(msg => !msg.includes('Failed')),
                message: configUpdateMessages.join('; ')
            };


            // Build final response
            const firstRuleName = allRuleDetails.length > 0 ? allRuleDetails[0].name : 'custom-rules';
            const rulesetList = rulesetPaths.join(', ');

            // Generate testing instructions
            const enginesUsed = Array.from(new Set(ruleConfigs.map(r => r.engine)));
            const engineCommands = enginesUsed.map(engine => `   - Engine "${engine}": sf code-analyzer run --rule-selector ${engine}:Custom`).join('\n');
            const testingInstructions = `TESTING INSTRUCTIONS FOR LLM:

1. GENERATE TEST FILES:
   - Create test files that should trigger violations for each custom rule
   - Create test files that should NOT trigger violations (negative test cases)
   - Place test files in appropriate locations based on the rule's target language (e.g., force-app/main/default/classes/ for Apex rules)

2. RUN THE CUSTOM RULES:
   Get the engine name from the ruleConfigJson (each rule has an "engine" field: "pmd", "eslint", or "regex").
   For each engine used, run the following command:
${engineCommands}

3. VERIFY VIOLATIONS:
   - Check that the rules correctly identify violations in test files that should trigger them
   - Verify that rules do NOT trigger false positives in test files that should pass
   - Review the violation messages and locations to ensure they are accurate

4. REFINE XPATH LOGIC (if violations are incorrect):
   - If the rule is not catching expected violations or catching false positives, analyze the XPath logic carefully
   - Use the get_code_analyzer_node_details MCP tool to get detailed information about specific AST nodes if needed
   - Get the engine name from ruleConfigJson (the "engine" field: "pmd", "eslint", or "regex")
   - Call: get_code_analyzer_node_details(engine="<engine_from_ruleConfigJson>", language="<target_language>", nodeNames=["<node_name>"])
   - Use the returned node attributes and structure to build a more precise XPath expression
   - Iterate on the XPath until the rule correctly identifies all expected violations

5. ITERATE:
   - Update the rule configuration with improved XPath if needed
   - Re-apply the rule using apply_code_analyzer_custom_rule
   - Re-run the tests until the rule works correctly`;

            return {
                status: errors.length > 0 ? "partial" : "completed",
                rulesProcessed: allRuleDetails.length,
                rulesSucceeded: allRuleDetails.length,
                rulesFailed: errors.length,
                ruleDetails: allRuleDetails,
                filesCreated: allFilesCreated,
                filesModified: [{
                    type: "Code Analyzer Configuration",
                    path: configResult.configPath!,
                    modification: `Added ${rulesetPaths.length} ruleset(s) across ${Object.keys(rulesetsByEngine).length} engine(s): ${Object.entries(rulesetsByEngine).map(([eng, paths]) => `${eng}(${paths.length})`).join(', ')}`
                }],
                errors: errors.length > 0 ? errors : undefined,
                testingInstructions
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
    custom_rulesets: []
`;
            fs.writeFileSync(configPath, minimalConfig, 'utf-8');

            return {
                configPath,
                created: true,
                message: "Created minimal code-analyzer.yml"
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
            const templatePath = path.join(this.knowledgeBasePath, 'pmd', 'templates', 'pmd-ruleset-template.xml');
            
            if (!fs.existsSync(templatePath)) {
                return {
                    success: false,
                    error: `Template file not found: ${templatePath}`
                };
            }

            let template = fs.readFileSync(templatePath, 'utf-8');

            // Normalize XPath expression: remove newlines, normalize whitespace, ensure single line
            let normalizedXpath = ruleConfig.xpath
                .replace(/\r\n/g, ' ')  // Replace Windows line endings
                .replace(/\n/g, ' ')     // Replace Unix line endings
                .replace(/\r/g, ' ')     // Replace old Mac line endings
                .replace(/\t/g, ' ')     // Replace tabs
                .replace(/\s+/g, ' ')    // Normalize multiple spaces to single space
                .trim();                 // Remove leading/trailing whitespace

            // Basic validation: ensure XPath looks complete (has balanced brackets)
            const openBrackets = (normalizedXpath.match(/\[/g) || []).length;
            const closeBrackets = (normalizedXpath.match(/\]/g) || []).length;
            const openParens = (normalizedXpath.match(/\(/g) || []).length;
            const closeParens = (normalizedXpath.match(/\)/g) || []).length;
            
            if (openBrackets !== closeBrackets || openParens !== closeParens) {
                return {
                    success: false,
                    error: `XPath expression appears incomplete: mismatched brackets or parentheses. Open brackets: ${openBrackets}, Close brackets: ${closeBrackets}, Open parens: ${openParens}, Close parens: ${closeParens}. XPath length: ${normalizedXpath.length}`
                };
            }

            // Note: XPath is wrapped in CDATA in the template, so no XML escaping needed
            // However, we must ensure the XPath doesn't contain the CDATA end marker ]]> 
            // (though this is extremely unlikely in XPath expressions)
            if (normalizedXpath.includes(']]>')) {
                return {
                    success: false,
                    error: `XPath expression contains CDATA end marker ']]>' which is not allowed`
                };
            }

            // Replace placeholders - do XPath LAST to avoid any interference
            // Replace other placeholders first
            template = template.replace(/\{\{rulesetName\}\}/g, `Custom ${ruleConfig.rule_name} Rules`);
            template = template.replace(/\{\{rulesetDescription\}\}/g, 
                `Custom rules generated via MCP tool. ${ruleConfig.description}`);
            template = template.replace(/\{\{ruleName\}\}/g, ruleConfig.rule_name);
            template = template.replace(/\{\{ruleMessage\}\}/g, ruleConfig.message);
            template = template.replace(/\{\{ruleDescription\}\}/g, ruleConfig.description);
            template = template.replace(/\{\{priority\}\}/g, String(ruleConfig.severity));
            template = template.replace(/\{\{documentationUrl\}\}/g, 
                ruleConfig.documentationUrl || 'https://your-org.com/standards');
            template = template.replace(/\{\{exampleCode\}\}/g, 
                ruleConfig.exampleCode || '// See rule description for examples');
            
            // Replace XPath expression LAST with exact match (not global) to ensure single replacement
            const xpathPlaceholder = '{{xpathExpression}}';
            if (!template.includes(xpathPlaceholder)) {
                return {
                    success: false,
                    error: `Template missing xpathExpression placeholder`
                };
            }
            template = template.replace(xpathPlaceholder, normalizedXpath);
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

    private updateCodeAnalyzerConfig(configPath: string, ruleXmlRelativePath: string, engine: SupportedEngine = 'pmd'): {
        success: boolean
        message: string
        error?: string
    } {
        return this.updateCodeAnalyzerConfigMultiple(configPath, [ruleXmlRelativePath], engine);
    }

    private updateCodeAnalyzerConfigMultiple(configPath: string, ruleXmlRelativePaths: string[], engine: SupportedEngine): {
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
            if (!config.engines[engine]) config.engines[engine] = {};
            
            // Different engines use different property names for custom rulesets
            const rulesetProperty = engine === 'pmd' ? 'custom_rulesets' : 
                                   engine === 'eslint' ? 'custom_rules' : 
                                   'custom_patterns';
            
            if (!config.engines[engine][rulesetProperty]) {
                config.engines[engine][rulesetProperty] = [];
            }

            // Add custom rulesets if not already present
            const added: string[] = [];
            const alreadyExists: string[] = [];
            
            for (const rulePath of ruleXmlRelativePaths) {
                if (!config.engines[engine][rulesetProperty].includes(rulePath)) {
                    config.engines[engine][rulesetProperty].push(rulePath);
                    added.push(rulePath);
                } else {
                    alreadyExists.push(rulePath);
                }
            }

            if (added.length > 0) {
                const updatedContent = yaml.dump(config, {noRefs: true, sortKeys: false});
                fs.writeFileSync(configPath, updatedContent, 'utf-8');
            }

            const messages: string[] = [];
            if (added.length > 0) {
                messages.push(`Added ${added.length} ruleset(s): ${added.join(', ')}`);
            }
            if (alreadyExists.length > 0) {
                messages.push(`${alreadyExists.length} ruleset(s) already exist: ${alreadyExists.join(', ')}`);
            }

            return {
                success: true,
                message: messages.join('; ')
            };
        } catch (e) {
            return {
                success: false,
                message: `Failed to update config: ${getErrorMessage(e)}`,
                error: getErrorMessage(e)
            };
        }
    }
}