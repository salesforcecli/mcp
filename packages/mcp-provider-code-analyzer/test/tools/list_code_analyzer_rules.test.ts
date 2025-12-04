import {describe, it, expect} from 'vitest';
import { CodeAnalyzerListRulesMcpTool } from '../../src/tools/list_code_analyzer_rules.js';
import { ReleaseState, Toolset } from '@salesforce/mcp-provider-api';
import { ListRulesAction, ListRulesInput, ListRulesOutput } from '../../src/actions/list-rules.js';

class StubListRulesAction implements ListRulesAction {
    private readonly outputOrError: ListRulesOutput | Error;

    public constructor(outputOrError: ListRulesOutput | Error) {
        this.outputOrError = outputOrError;
    }

    public async exec(_input: ListRulesInput): Promise<ListRulesOutput> {
        if (this.outputOrError instanceof Error) {
            throw this.outputOrError;
        }
        return this.outputOrError;
    }
}

describe('CodeAnalyzerListRulesMcpTool', () => {
    it('returns structured content on success', async () => {
        const expected: ListRulesOutput = {
            status: 'success',
            rules: [{
                name: 'stub1RuleA',
                engine: 'EngineThatLogsError',
                severity: 5,
                tags: ['Recommended'],
                description: 'Some description',
                resources: ['https://example.com/stub1RuleA']
            }]
        };
        const tool = new CodeAnalyzerListRulesMcpTool(new StubListRulesAction(expected));

        const result = await tool.exec({ selector: 'Recommended' });

        expect(result.structuredContent).toEqual(expected);
        const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
        expect(JSON.parse(text)).toEqual(expected);
    });

    it('catches errors and returns error status', async () => {
        const tool = new CodeAnalyzerListRulesMcpTool(new StubListRulesAction(new Error('Boom')));

        const result = await tool.exec({ selector: 'anything' });

        expect(result.structuredContent?.status).toContain('Boom');
    });

    it('exposes metadata: name, release state, toolsets', () => {
        const tool = new CodeAnalyzerListRulesMcpTool(new StubListRulesAction({ status: 'success', rules: [] }));
        expect(tool.getName()).toEqual('list_code_analyzer_rules');
        expect(tool.getReleaseState()).toEqual(ReleaseState.NON_GA);
        expect(tool.getToolsets()).toEqual([Toolset.CODE_ANALYSIS]);
    });

    it('returns a valid config with description, schemas and annotations', () => {
        const tool = new CodeAnalyzerListRulesMcpTool(new StubListRulesAction({ status: 'success', rules: [] }));
        const cfg = tool.getConfig();
        expect(cfg.title).toEqual('List Code Analyzer Rules');
        expect(typeof cfg.description).toBe('string');
        expect(cfg.description).toContain('selector');
        expect(cfg.inputSchema).toBeDefined();
        expect(cfg.outputSchema).toBeDefined();
        expect(cfg.annotations?.readOnlyHint).toBe(true);
    });
});


