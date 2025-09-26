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

import { expect } from 'chai';
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { z } from 'zod';
import { listAllOrgsParamsSchema } from '../../src/tools/list_all_orgs.js';

describe('list_all_orgs', () => {
    let testSession: TestSession;

    const listAllOrgsSchema = {
        name: z.literal('list_all_orgs'),
        params: listAllOrgsParamsSchema,
    };

    before(async () => {
        testSession = await TestSession.create({
            project: {
                name: 'MyTestProject',
            },
            scratchOrgs: [{ edition: 'developer', setDefault: true }],
            devhubAuthStrategy: 'AUTO',
        });
    });

    after(async () => {
        if (testSession) {
            await testSession.clean();
        }
    });

    describe('with ALLOW_ALL_ORGS', () => {
        const client = new McpTestClient();

        before(async () => {
            const transport = DxMcpTransport({
                args: ['--orgs', 'ALLOW_ALL_ORGS', '--toolsets', 'all', '--no-telemetry', '--allow-non-ga-tools'],
            });
            await client.connect(transport);
        });

        after(async () => {
            if (client?.connected) {
                await client.disconnect();
            }
        });

        it('should list all orgs', async () => {
            const result = await client.callTool(listAllOrgsSchema, {
                name: 'list_all_orgs',
                params: {
                    directory: testSession.project.dir,
                },
            });

            expect(result.isError).to.be.false;
            expect(result.content.length).to.equal(1);
            expect(result.content[0].type).to.equal('text');

            const responseText = result.content[0].text;
            expect(responseText).to.contain('List of configured Salesforce orgs:');
        });

        it('should return error message when directory does not exist', async () => {
            const result = await client.callTool(listAllOrgsSchema, {
                name: 'list_all_orgs',
                params: {
                    directory: '/nonexistent/directory/path',
                },
            });

            expect(result.isError).to.be.true;
            expect(result.content.length).to.equal(1);
            expect(result.content[0].type).to.equal('text');

            const responseText = result.content[0].text;
            expect(responseText).to.contain('Failed to list orgs');
        });
    });

    describe('with DEFAULT_TARGET_ORG only', () => {
        const defaultOrgClient = new McpTestClient();

        before(async () => {
            const transport = DxMcpTransport({
                args: ['--orgs', 'DEFAULT_TARGET_ORG', '--toolsets', 'all', '--no-telemetry', '--allow-non-ga-tools'],
            });
            await defaultOrgClient.connect(transport);
        });

        after(async () => {
            if (defaultOrgClient?.connected) {
                await defaultOrgClient.disconnect();
            }
        });

        it('should only list the default org', async () => {
            const result = await defaultOrgClient.callTool(listAllOrgsSchema, {
                name: 'list_all_orgs',
                params: {
                    directory: testSession.project.dir,
                },
            });

            expect(result.isError).to.be.false;
            expect(result.content.length).to.equal(1);
            expect(result.content[0].type).to.equal('text');

            const responseText = result.content[0].text;
            expect(responseText).to.contain('List of configured Salesforce orgs:');
        });
    });
});
