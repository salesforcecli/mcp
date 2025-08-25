import { McpProvider,  McpTool, Services } from "@salesforce/mcp-provider-api";
import { CodeAnalyzerRunMcpTool } from "./tools/sf-code-analyzer-run.js";
import { CodeAnalyzerDescribeRuleMcpTool } from "./tools/sf-code-analyzer-describe-rule.js";

export class CodeAnalyzerMcpProvider extends McpProvider {
    public getName(): string {
        return "CodeAnalyzerMcpProvider"
    }
    
    public provideTools(_services: Services): Promise<McpTool[]> {
        return Promise.resolve([
            new CodeAnalyzerRunMcpTool(),
            new CodeAnalyzerDescribeRuleMcpTool()
        ]);
    }
}