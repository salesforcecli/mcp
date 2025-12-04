import {describe, it, expect, vi} from 'vitest';

vi.mock('../../src/actions/list-rules.js', () => {
    class MockListRulesActionImpl {
        public constructor(_opts: unknown) {}
        public async exec(_input: unknown) {
            return { status: 'success', rules: [] };
        }
    }
    return {
        ListRulesActionImpl: MockListRulesActionImpl
    };
});

describe('CodeAnalyzerListRulesMcpTool (default constructor)', async () => {
    const { CodeAnalyzerListRulesMcpTool } = await import('../../src/tools/list_code_analyzer_rules.js');

    it('uses default action when none provided', async () => {
        const tool = new CodeAnalyzerListRulesMcpTool(); // triggers default param on line 43
        const result = await tool.exec({ selector: 'any' });
        expect(result.structuredContent?.status).toEqual('success');
        expect(Array.isArray(result.structuredContent?.rules)).toBe(true);
        expect((result.structuredContent?.rules as { length: number }[])?.length).toEqual(0);
    });
});


