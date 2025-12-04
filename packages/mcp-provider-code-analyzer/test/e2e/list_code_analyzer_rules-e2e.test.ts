import { z } from 'zod';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { inputSchema } from '../../src/tools/list_code_analyzer_rules.js';

describe('list_code_analyzer_rules', () => {
    const client = new McpTestClient({
        timeout: 60000
    });

    const testInputSchema = {
        name: z.literal('list_code_analyzer_rules'),
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

    it('should list rules for Recommended selector', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'list_code_analyzer_rules',
            params: {
                selector: 'Recommended'
            }
        });

        expect(result.structuredContent!.status).toEqual('success');
        expect(Array.isArray(result.structuredContent!.rules)).toBe(true);
        expect((result.structuredContent!.rules as { length: number }[])?.length).toBeGreaterThan(0);
    }, 30000);

    it('should return empty rules for a non-matching selector', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'list_code_analyzer_rules',
            params: {
                selector: 'ThisTagDoesNotExist'
            }
        });

        expect(result.structuredContent!.status).toEqual('success');
        expect((result.structuredContent!.rules as { length: number }[])?.length).toEqual(0);
    }, 30000);
});

