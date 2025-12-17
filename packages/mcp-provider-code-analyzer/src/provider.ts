import { McpProvider,  McpTool, Services } from "@salesforce/mcp-provider-api";
import { CodeAnalyzerRunMcpTool } from "./tools/run_code_analyzer.js";
import { CodeAnalyzerDescribeRuleMcpTool } from "./tools/describe_code_analyzer_rule.js";
import { CodeAnalyzerListRulesMcpTool } from "./tools/list_code_analyzer_rules.js";
import { CreateCodeAnalyzerCustomRuleMcpTool } from "./tools/create_code_analyzer_custom_rule.js";
import { GetNodeDetailsMcpTool } from "./tools/get_node_details.js";
import {CodeAnalyzerConfigFactory, CodeAnalyzerConfigFactoryImpl} from "./factories/CodeAnalyzerConfigFactory.js";
import {EnginePluginsFactory, EnginePluginsFactoryImpl} from "./factories/EnginePluginsFactory.js";
import {RunAnalyzerActionImpl} from "./actions/run-analyzer.js";
import {DescribeRuleActionImpl} from "./actions/describe-rule.js";
import { ListRulesActionImpl } from "./actions/list-rules.js";

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
            new CreateCodeAnalyzerCustomRuleMcpTool(),
            new GetNodeDetailsMcpTool()
        ]);
    }
}