import { McpProvider,  McpTool, Services } from "@salesforce/mcp-provider-api";
import { CodeAnalyzerRunMcpTool } from "./tools/run_code_analyzer.js";
import { CodeAnalyzerDescribeRuleMcpTool } from "./tools/describe_code_analyzer_rule.js";
import { CreateCustomPmdRuleMcpTool } from "./tools/create_custom_pmd_rule.js";
import { ApplyCustomPmdRuleMcpTool } from "./tools/apply_custom_pmd_rule.js";
import { GetPmdNodeDetailsMcpTool } from "./tools/get_pmd_node_details.js";
import {CodeAnalyzerConfigFactory, CodeAnalyzerConfigFactoryImpl} from "./factories/CodeAnalyzerConfigFactory.js";
import {EnginePluginsFactory, EnginePluginsFactoryImpl} from "./factories/EnginePluginsFactory.js";
import {RunAnalyzerActionImpl} from "./actions/run-analyzer.js";
import {DescribeRuleActionImpl} from "./actions/describe-rule.js";
import {CreateCustomRuleActionImpl} from "./actions/create-custom-rule.js";
import {ApplyCustomRuleActionImpl} from "./actions/apply-custom-rule.js";
import {GetNodeDetailsActionImpl} from "./actions/get-node-details.js";

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
            new CreateCustomPmdRuleMcpTool(new CreateCustomRuleActionImpl()),
            new ApplyCustomPmdRuleMcpTool(new ApplyCustomRuleActionImpl()),
            new GetPmdNodeDetailsMcpTool(new GetNodeDetailsActionImpl())
        ]);
    }
}