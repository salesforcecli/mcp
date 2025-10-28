/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, assert } from 'chai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { DxMcpTransport } from '@salesforce/mcp-test-client';

const execAsync = promisify(exec);

async function getMcpClient(opts: { args: string[]; tools?: string[] }) {
    const client = new Client({
        name: 'sf-tools',
        version: '0.0.1',
    });

    const transport = DxMcpTransport({
        args: opts.args,
        ...(opts.tools ? { tools: opts.tools } : {}),
    });

    await client.connect(transport);

    return client;
}

async function getExpectedArgsAndTools(): Promise<{ args: string[]; tools: string[] }> {
    try {
        const result = await execAsync('gh api repos/forcedotcom/cline-fork/contents/src/shared/mcp/a4dServerArgs.json | jq -r .content | base64 --decode');
        
        if (result.stderr) {
            throw new Error(`Command failed: ${result.stderr}`);
        }
        
        const config = JSON.parse(result.stdout.trim()) as Record<string, unknown>;
        
        // Extract args and tools for the MCP repository
        const mcpRepoConfig = config['https://github.com/salesforcecli/mcp'] as { args?: string[]; tools?: string[] };
        if (!mcpRepoConfig) {
            throw new Error('MCP repository configuration not found in a4dServerArgs.json');
        }

        return {
            args: mcpRepoConfig.args ?? [],
            tools: mcpRepoConfig.tools ?? []
        };
    } catch (error) {
        throw new Error(`Failed to fetch a4dServerArgs.json via gh command: ${String(error)}`);
    }
}

describe('specific tool registration', () => {
    it('should enable tools matching ', async () => {
        const { tools: expectedTools } = await getExpectedArgsAndTools();

        const clientArgs = [
            '--orgs', 'ALLOW_ALL_ORGS',
            '--tools', expectedTools.join(','),
            '--no-telemetry'
        ];
        
        const client = await getMcpClient({
            args: clientArgs, tools: expectedTools,
        });

        try {
            const initialTools = (await client.listTools()).tools.map((t) => t.name).sort();

            expect(initialTools.length).to.equal(expectedTools.length);
            expect(initialTools).to.deep.equal(expectedTools);
        } catch (err) {
            assert.fail(`Failed to validate tools against a4dServerArgs.json: ${String(err)}`);
        } finally {
            await client.close();
        }
    });
});
