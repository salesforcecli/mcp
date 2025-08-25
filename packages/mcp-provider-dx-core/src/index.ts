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
import { AssignPermissionSetMcpTool } from './tools/sf-assign-permission-set.js';
import { CreateOrgSnapshotMcpTool } from './tools/sf-create-org-snapshot.js';
import { CreateScratchOrgMcpTool } from './tools/sf-create-scratch-org.js';
import { DeleteOrgMcpTool } from './tools/sf-delete-org.js';
import { DeployMetadataMcpTool } from './tools/sf-deploy-metadata.js';
import { GetUsernameMcpTool } from './tools/sf-get-username.js';
import { ListAllOrgsMcpTool } from './tools/sf-list-all-orgs.js';
import { OrgOpenMcpTool } from './tools/sf-org-open.js';
import { QueryOrgMcpTool } from './tools/sf-query-org.js';
import { ResumeMcpTool } from './tools/sf-resume.js';
import { RetrieveMetadataMcpTool } from './tools/sf-retrieve-metadata.js';
import { TestAgentsMcpTool } from './tools/sf-test-agents.js';
import { TestApexMcpTool } from './tools/sf-test-apex.js';

export class DxCoreMcpProvider extends McpProvider {
  public getName(): string {
    return 'DxCoreMcpProvider';
  }

  public provideTools(services: Services): Promise<McpTool[]> {
    return Promise.resolve([
      new AssignPermissionSetMcpTool(services),
      new CreateOrgSnapshotMcpTool(services),
      new CreateScratchOrgMcpTool(),
      new DeleteOrgMcpTool(),
      new DeployMetadataMcpTool(services),
      new GetUsernameMcpTool(services),
      new ListAllOrgsMcpTool(services),
      new OrgOpenMcpTool(),
      new QueryOrgMcpTool(services),
      new ResumeMcpTool(services),
      new RetrieveMetadataMcpTool(services),
      new TestAgentsMcpTool(services),
      new TestApexMcpTool(services),
    ]);
  }
}
