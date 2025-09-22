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
import { AssignPermissionSetMcpTool } from './tools/assign_permission_set.js';
import { CreateOrgSnapshotMcpTool } from './tools/create_org_snapshot.js';
import { CreateScratchOrgMcpTool } from './tools/create_scratch_org.js';
import { DeleteOrgMcpTool } from './tools/delete_org.js';
import { DeployMetadataMcpTool } from './tools/deploy_metadata.js';
import { GetUsernameMcpTool } from './tools/get_username.js';
import { ListAllOrgsMcpTool } from './tools/list_all_orgs.js';
import { OrgOpenMcpTool } from './tools/open_org.js';
import { QueryOrgMcpTool } from './tools/run_soql_query.js';
import { ResumeMcpTool } from './tools/resume_tool_operation.js';
import { RetrieveMetadataMcpTool } from './tools/retrieve_metadata.js';
import { TestAgentsMcpTool } from './tools/run_agent_test.js';
import { TestApexMcpTool } from './tools/run_apex_test.js';

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
