import { McpProvider, McpTool, Services } from "@salesforce/mcp-provider-api";
import { CodeAnalyzerMcpProvider } from "../src/provider.js";
import { CodeAnalyzerRunMcpTool } from "../src/tools/run_code_analyzer.js";
import { StubServices } from "./test-doubles.js";
import { CodeAnalyzerDescribeRuleMcpTool } from "../src/tools/describe_code_analyzer_rule.js";
import { CodeAnalyzerListRulesMcpTool } from "../src/tools/list_code_analyzer_rules.js";
import { CodeAnalyzerQueryResultsMcpTool } from "../src/tools/query_code_analyzer_results.js";

describe("Tests for CodeAnalyzerMcpProvider", () => {
    let services: Services;
    let provider: McpProvider;

    beforeEach(() => {
        services = new StubServices();
        provider = new CodeAnalyzerMcpProvider();
    });

    it("When getName is called, then 'CodeAnalyzerMcpProvider' is returned", () => {
        expect(provider.getName()).toEqual('CodeAnalyzerMcpProvider');
    });

    it("When provideTools is called, then the returned array contains an CodeAnalyzerRunMcpTool instance", async () => {
        const tools: McpTool[] = await provider.provideTools(services);
        expect(tools).toHaveLength(4);
        expect(tools[0]).toBeInstanceOf(CodeAnalyzerRunMcpTool);
        expect(tools[1]).toBeInstanceOf(CodeAnalyzerDescribeRuleMcpTool);
        expect(tools[2]).toBeInstanceOf(CodeAnalyzerListRulesMcpTool);
        expect(tools[3]).toBeInstanceOf(CodeAnalyzerQueryResultsMcpTool);
    });
})