import path from 'node:path';
import { fileURLToPath } from "url";
import { z } from 'zod';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { inputSchema } from '../../src/tools/run_code_analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('run_code_analyzer', () => {
    const client = new McpTestClient({
        timeout: 60000
    });

    const testInputSchema = {
        name: z.literal('run_code_analyzer'),
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

    it.each([
        {
            case: 'violations are present',
            target: path.join(__dirname, '..', 'fixtures', 'sample-targets', 'ApexTarget2.cls'),
            expectedCount: 6
        },
        {
            case: 'no violations are present',
            target: path.join(__dirname, '..', 'fixtures', 'sample-targets', 'ApexTarget1.cls'),
            expectedCount: 0
        }
    ])('when $case, returns correct violation summary', async ({target, expectedCount}) => {
        const result = await client.callTool(testInputSchema, {
            name: 'run_code_analyzer',
            params: {
                target: [target]
            }
        }, 60000);

        expect(result.structuredContent!.status).toEqual('success');
        expect(result.structuredContent!.summary).toHaveProperty('total', expectedCount);
    }, 60000);

    it('errors when non-existent file is targeted', async () => {
        const result = await client.callTool(testInputSchema, {
            name: 'run_code_analyzer',
            params: {
                target: [path.join(__dirname, '..', 'fixtures', 'sample-targets', 'NoTargetWithThisName.cls')]
            }
        }, 60000);

        expect(result.structuredContent!.status).toContain('All targeted files must exist, but ');
    }, 60000)
})