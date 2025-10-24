import { z } from 'zod';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { inputSchema } from '../../src/tools/describe_code_analyzer_rule.js';

describe('describe_code_analyzer_rule', () => {
    const client = new McpTestClient({
        timeout: 60000
    });

    const testInputSchema = {
        name: z.literal('describe_code_analyzer_rule'),
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
    });

    afterAll(async () => {
        if (client?.connected) {
            await client.disconnect();
        }
    });

    it('should offer rule description for existing rule', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'describe_code_analyzer_rule',
            params: {
                ruleName: 'VfUnescapeEl',
                engineName: 'pmd'
            }
        });

        expect(result.structuredContent!.status).toEqual('success');
        expect(result.structuredContent!.rule).toHaveProperty('name', 'VfUnescapeEl');
        expect(result.structuredContent!.rule).toHaveProperty('engine', 'pmd');
        expect(result.structuredContent!.rule).toHaveProperty('severity', 2);
    });

    it('should offer error for non-existent rule', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'describe_code_analyzer_rule',
            params: {
                ruleName: 'NotARealRule',
                engineName: 'pmd'
            }
        });

        expect(result.structuredContent!.status).toContain(`No rule with name 'NotARealRule' exists in engine 'pmd'.`);
    });
})