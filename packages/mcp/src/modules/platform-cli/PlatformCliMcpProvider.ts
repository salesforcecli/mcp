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

import { McpProvider, McpTool, Services } from '@salesforce/mcp-provider-api';
import { AssignPermissionSetMcpTool } from './sf-assign-permission-set.js';
import { CreateOrgSnapshotMcpTool } from './sf-create-org-snapshot.js';
import { CreateScratchOrgMcpTool } from './sf-create-scratch-org.js';
import { DeleteOrgMcpTool } from './sf-delete-org.js';
import { DeployMetadataMcpTool } from './sf-deploy-metadata.js';
import { GetUsernameMcpTool } from './sf-get-username.js';
import { ListAllOrgsMcpTool } from './sf-list-all-orgs.js';
import { OrgOpenMcpTool } from './sf-org-open.js';
import { QueryOrgMcpTool } from './sf-query-org.js';
import { ResumeMcpTool } from './sf-resume.js';
import { RetrieveMetadataMcpTool } from './sf-retrieve-metadata.js';
import { SuggestCliCommandMcpTool } from './sf-suggest-cli-command.js';
import { TestAgentsMcpTool } from './sf-test-agents.js';
import { TestApexMcpTool } from './sf-test-apex.js';

export class PlatformCliMcpProvider extends McpProvider {
    public getName(): string {
        return 'PlatformCliMcpProvider';
    }

    public provideTools(_services: Services): Promise<McpTool[]> {
        return Promise.resolve([
            new AssignPermissionSetMcpTool(),
            new CreateOrgSnapshotMcpTool(),
            new CreateScratchOrgMcpTool(),
            new DeleteOrgMcpTool(),
            new DeployMetadataMcpTool(),
            new GetUsernameMcpTool(),
            new ListAllOrgsMcpTool(),
            new OrgOpenMcpTool(),
            new QueryOrgMcpTool(),
            new ResumeMcpTool(),
            new RetrieveMetadataMcpTool(),
            new SuggestCliCommandMcpTool(),
            new TestAgentsMcpTool(),
            new TestApexMcpTool()
        ]);
    }
}