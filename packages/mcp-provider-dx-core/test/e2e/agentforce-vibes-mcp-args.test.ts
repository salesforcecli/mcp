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

async function getMcpClient(opts: { args: string[] }) {
    const client = new Client({
        name: 'sf-tools',
        version: '0.0.1',
    });

    const transport = DxMcpTransport({
        args: opts.args,
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
    // skip only on Windows
    const itIf = process.platform === 'win32' ? it.skip : it;
    
    itIf('should initialize MCP with tools specified in AFV config', async () => {
        const { args, tools: expectedTools } = await getExpectedArgsAndTools();

        const client = await getMcpClient({
            args: [
            ...args, 
            '--tools', expectedTools.join(','),
            '--no-telemetry', 
            '--allow-non-ga-tools'
        ],
        });

        try {
            const AllTools = (await client.listTools()).tools.map((t) => t.name).sort();
            expect(AllTools).to.be.an('array').that.is.not.empty;

            // Filter to only include tools that are in the expectedTools list
            const initialTools = AllTools.filter(tool => expectedTools.includes(tool)).sort();

            const missingTools = expectedTools.filter(tool => !initialTools.includes(tool));
            expect(missingTools).to.be.empty;

            expect(initialTools).to.be.an('array');
            expect(initialTools.length).to.deep.equal(expectedTools.length);
            
            // Verify that each expected tool is loaded
            expectedTools.forEach(expectedTool => {
                expect(initialTools).to.include(expectedTool);
            });

            // Validate tool names are valid (non-empty strings)
            initialTools.forEach(toolName => {
                expect(toolName).to.be.a('string').that.is.not.empty;
            });

        } catch (err) {
            assert.fail(`Failed to validate tools against a4dServerArgs.json: ${String(err)}`);
        } finally {
            await client.close();
        }
    });
});
