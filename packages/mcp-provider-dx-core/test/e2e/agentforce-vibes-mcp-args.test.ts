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

import { expect, assert } from 'chai';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { DxMcpTransport } from '@salesforce/mcp-test-client';

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

describe('specific tool registration', () => {
    it('should enable All tools', async () => {
        const client = await getMcpClient({
        args: ['--orgs', 'ALLOW_ALL_ORGS', '--toolsets', 'metadata', '--no-telemetry'],
        });

        try {
        const initialTools = (await client.listTools()).tools.map((t) => t.name).sort();

        expect(initialTools.length).to.equal(20);
        expect(initialTools).to.deep.equal(
            [
                'get_username',
				'run_apex_test',
				'run_soql_query',
				'guide_lwc_development',
				'orchestrate_lwc_component_creation',
				'guide_lwc_accessibility',
				'create_lwc_component_from_prd',
				'assign_permission_set',
				'list_all_orgs',
				'list_devops_center_projects',
				'list_devops_center_work_items',
				'create_devops_center_pull_request',
				'promote_devops_center_work_item',
				'commit_devops_center_work_item',
				'check_devops_center_commit_status',
				'checkout_devops_center_work_item',
				'run_code_analyzer',
				'describe_code_analyzer_rule',
				'detect_devops_center_merge_conflict',
				'resolve_devops_center_merge_conflict'
            ].sort(),
        );
        } catch (err) {
        console.error(err);
        assert.fail();
        } finally {
        await client.close();
        }
    });
});
