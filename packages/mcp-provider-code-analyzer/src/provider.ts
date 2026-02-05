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
import { GetAstNodesActionImpl } from "./actions/get-ast-nodes.js";

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
            new GenerateXpathPromptMcpTool(new GetAstNodesActionImpl(), services.getTelemetryService())
        ]);
    }
}