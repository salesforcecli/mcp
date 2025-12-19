import { z } from 'zod';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { inputSchema } from '../../src/tools/create_code_analyzer_custom_rule.js';
import { CreateCustomRuleOutput } from '../../src/actions/create-custom-rule.js';

describe('create_code_analyzer_custom_rule', () => {
    const client = new McpTestClient({
        timeout: 1000
    });

    const testInputSchema = {
        name: z.literal('create_code_analyzer_custom_rule'),
        params: inputSchema
    };

    beforeAll(async () => {
        try {
            const transport = DxMcpTransport({
                args: ['--toolsets', 'code-analysis', '--orgs', 'DEFAULT_TARGET_ORG', '--no-telemetry', '--allow-non-ga-tools']
            });
            await client.connect(transport);
        } catch (error) {
            console.error('Setup failed:', error);
            throw error;
        }
    }, 30000);

    afterAll(async () => {
        if (client?.connected) {
            await client.disconnect();
        }
    });

    it('should return knowledge base with availableNodes for PMD + Apex', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params: {
                engine: 'pmd',
                language: 'apex'
            }
        }, 1000);

        const output = result.structuredContent as CreateCustomRuleOutput;
        expect(output.status).toEqual('ready_for_xpath_generation');
        expect(output.knowledgeBase).toBeDefined();
        expect(output.knowledgeBase!.availableNodes).toBeDefined();
        expect(Array.isArray(output.knowledgeBase!.availableNodes)).toBe(true);
        expect(output.knowledgeBase!.availableNodes!.length).toBeGreaterThan(0);
        expect(output.knowledgeBase!.nodeCount).toBeDefined();
        expect(output.knowledgeBase!.nodeCount).toBeGreaterThan(0);
    }, 1000);

    it('should include common Apex AST nodes in availableNodes', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params: {
                engine: 'pmd',
                language: 'apex'
            }
        }, 1000);

        const output = result.structuredContent as CreateCustomRuleOutput;
        const availableNodes = output.knowledgeBase?.availableNodes || [];
        expect(availableNodes).toContain('UserClass');
        expect(availableNodes).toContain('Method');
        expect(availableNodes).toContain('MethodCallExpression');
        expect(availableNodes).toContain('ModifierNode');
        
        // Verify structure is array of strings (token optimization)
        if (availableNodes.length > 0) {
            expect(typeof availableNodes[0]).toBe('string');
        }
    }, 1000);

    it('should return instructionsForLlm and nextStep', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params: {
                engine: 'pmd',
                language: 'apex'
            }
        }, 1000);

        const output = result.structuredContent as CreateCustomRuleOutput;
        expect(output.instructionsForLlm).toBeDefined();
        expect(output.instructionsForLlm).toContain('XPath');
        expect(output.nextStep).toBeDefined();
        expect(output.nextStep!.action).toContain('get_code_analyzer_node_details');
        expect(output.nextStep!.then).toContain('apply_code_analyzer_custom_rule');
    }, 1000);

    it('should handle case-insensitive language input', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params: {
                engine: 'pmd',
                language: 'APEX' // uppercase
            }
        }, 1000);

        const output = result.structuredContent as CreateCustomRuleOutput;
        expect(output.status).toEqual('ready_for_xpath_generation');
        expect(output.knowledgeBase).toBeDefined();
        expect(output.knowledgeBase!.availableNodes!.length).toBeGreaterThan(0);
    }, 1000);

    it('should return error for unsupported engine (eslint)', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params: {
                engine: 'eslint',
                language: 'javascript'
            }
        }, 1000);

        const output = result.structuredContent as CreateCustomRuleOutput;
        expect(output.status).toEqual('error');
        expect(output.error).toContain('does not support custom rules');
        expect(output.knowledgeBase).toBeUndefined();
    }, 1000);

    it('should return error for unsupported engine (regex)', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params: {
                engine: 'regex',
                language: 'apex'
            }
        }, 1000);

        const output = result.structuredContent as CreateCustomRuleOutput;
        expect(output.status).toEqual('error');
        expect(output.error).toContain('does not support custom rules');
    }, 1000);

    it('should return error for unsupported language with PMD', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params: {
                engine: 'pmd',
                language: 'javascript'
            }
        }, 1000);

        const output = result.structuredContent as CreateCustomRuleOutput;
        expect(output.status).toEqual('error');
        expect(output.error).toContain('support is not yet added');
        expect(output.error).toContain('Currently supported languages: apex');
    }, 1000);

    it('should return error for typescript language', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params: {
                engine: 'pmd',
                language: 'typescript'
            }
        }, 1000);

        const output = result.structuredContent as CreateCustomRuleOutput;
        expect(output.status).toEqual('error');
        expect(output.error).toContain('support is not yet added');
    }, 1000);

    it('should return error when language is empty', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params: {
                engine: 'pmd',
                language: ''
            }
        }, 1000);

        const output = result.structuredContent as CreateCustomRuleOutput;
        expect(output.status).toEqual('error');
        expect(output.error).toContain('language is required');
    }, 1000);

    it('should return consistent results when called multiple times with same engine+language', async () => {
        const params = {
            engine: 'pmd' as const,
            language: 'apex' as const
        };

        const result1 = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params
        }, 1000);

        const result2 = await client.callTool(testInputSchema, {
            name: 'create_code_analyzer_custom_rule',
            params
        }, 1000);

        const output1 = result1.structuredContent as CreateCustomRuleOutput;
        const output2 = result2.structuredContent as CreateCustomRuleOutput;
        expect(output1.status).toEqual('ready_for_xpath_generation');
        expect(output2.status).toEqual('ready_for_xpath_generation');
        expect(output1.knowledgeBase!.nodeCount).toEqual(
            output2.knowledgeBase!.nodeCount
        );
        expect(output1.knowledgeBase!.availableNodes!.length).toEqual(
            output2.knowledgeBase!.availableNodes!.length
        );
    }, 120000);
});

