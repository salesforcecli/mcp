import { McpProvider,  McpTool, Services } from "@salesforce/mcp-provider-api";
import { CodeAnalyzerRunMcpTool } from "./tools/run_code_analyzer.js";
import { CodeAnalyzerDescribeRuleMcpTool } from "./tools/describe_code_analyzer_rule.js";
import { CodeAnalyzerListRulesMcpTool } from "./tools/list_code_analyzer_rules.js";
import { CodeAnalyzerQueryResultsMcpTool } from "./tools/query_code_analyzer_results.js";
import { QueryResultsActionImpl } from "./actions/query-results.js";
import {CodeAnalyzerConfigFactory, CodeAnalyzerConfigFactoryImpl} from "./factories/CodeAnalyzerConfigFactory.js";
import {EnginePluginsFactory, EnginePluginsFactoryImpl} from "./factories/EnginePluginsFactory.js";
import {RunAnalyzerActionImpl} from "./actions/run-analyzer.js";
import {DescribeRuleActionImpl} from "./actions/describe-rule.js";
import { ListRulesActionImpl } from "./actions/list-rules.js";
import { GenerateXpathPromptMcpTool } from "./tools/generate_xpath_prompt.js";
import { CreateCustomRuleMcpTool } from "./tools/create_custom_rule.js";
// import { CreateRegexRuleMcpTool } from "./tools/create_regex_rule.js"; // Temporary tool - not registered
import { GetAstNodesActionImpl } from "./actions/get-ast-nodes.js";
import { RuleCreationStrategyFactory } from "./strategies/RuleCreationStrategyFactory.js";
// import { CreateRegexCustomRuleActionImpl } from "./actions/create-regex-custom-rule.js"; // Used by strategy

export class CodeAnalyzerMcpProvider extends McpProvider {
    public getName(): string {
        return "CodeAnalyzerMcpProvider"
    }
    
    public provideTools(services: Services): Promise<McpTool[]> {
        const configFactory: CodeAnalyzerConfigFactory = new CodeAnalyzerConfigFactoryImpl()
        const enginePluginsFactory: EnginePluginsFactory = new EnginePluginsFactoryImpl()
        return Promise.resolve([
            new CodeAnalyzerRunMcpTool(new RunAnalyzerActionImpl({
                configFactory,
                enginePluginsFactory,
                telemetryService: services.getTelemetryService()
            })),
            new CodeAnalyzerDescribeRuleMcpTool(new DescribeRuleActionImpl({
                configFactory,
                enginePluginsFactory,
                telemetryService: services.getTelemetryService()
            })),
            new CodeAnalyzerListRulesMcpTool(new ListRulesActionImpl({
                configFactory,
                enginePluginsFactory,
                telemetryService: services.getTelemetryService()
            })),
            new CodeAnalyzerQueryResultsMcpTool(new QueryResultsActionImpl(), services.getTelemetryService()),
            new GenerateXpathPromptMcpTool(new GetAstNodesActionImpl(), services.getTelemetryService()),
            new CreateCustomRuleMcpTool(new RuleCreationStrategyFactory(), services.getTelemetryService())
            // NOTE: create_regex_rule tool is NOT registered - kept in codebase for reference only
            // Use create_custom_rule with engine: "regex" to test regex rule creation via strategy pattern
        ]);
    }
}