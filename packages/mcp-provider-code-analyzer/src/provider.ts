import { McpProvider,  McpTool, Services } from "@salesforce/mcp-provider-api";
import { CodeAnalyzerRunMcpTool } from "./tools/sf-code-analyzer-run.js";
import { CodeAnalyzerDescribeRuleMcpTool } from "./tools/sf-code-analyzer-describe-rule.js";
import {CodeAnalyzerConfigFactory, CodeAnalyzerConfigFactoryImpl} from "./factories/CodeAnalyzerConfigFactory.js";
import {EnginePluginsFactory, EnginePluginsFactoryImpl} from "./factories/EnginePluginsFactory.js";
import {RunAnalyzerActionImpl} from "./actions/run-analyzer.js";
import {DescribeRuleActionImpl} from "./actions/describe-rule.js";

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
            }))
        ]);
    }
}