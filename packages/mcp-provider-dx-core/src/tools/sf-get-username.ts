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

import { z } from 'zod';
import { McpTool, McpToolConfig, OrgConfigInfo, ReleaseState, Services, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type OrgService } from '@salesforce/mcp-provider-api';
import { textResponse } from '../shared/utils.js';
import { directoryParam } from '../shared/params.js';
import { type ToolTextResponse } from '../shared/types.js';

export async function suggestUsername(orgService: OrgService): Promise<{
  suggestedUsername: string | undefined;
  reasoning: string;
  aliasForReference?: string;
}> {
  let reasoning: string;
  let suggestedUsername: string | undefined;
  let aliasForReference: string | undefined;

  const allAllowedOrgs = await orgService.getAllowedOrgs();
  const defaultTargetOrg = await orgService.getDefaultTargetOrg();
  const defaultTargetDevHub = await orgService.getDefaultTargetDevHub();

  const targetOrgLocation = defaultTargetOrg?.location ? `(${defaultTargetOrg.location}) ` : '';
  const targetDevHubLocation = defaultTargetDevHub?.location ? `(${defaultTargetDevHub.location}) ` : '';

  if (allAllowedOrgs.length === 1) {
    suggestedUsername = allAllowedOrgs[0].username;
    aliasForReference = allAllowedOrgs[0].aliases?.[0];
    reasoning = 'it was the only org found in the MCP Servers allowlisted orgs';
  } else if (defaultTargetOrg?.value) {
    const foundOrg = orgService.findOrgByUsernameOrAlias(allAllowedOrgs, defaultTargetOrg.value);
    suggestedUsername = foundOrg?.username;
    aliasForReference = foundOrg?.aliases?.[0];
    reasoning = `it is the default ${targetOrgLocation}target org`;
  } else if (defaultTargetDevHub?.value) {
    const foundOrg = orgService.findOrgByUsernameOrAlias(allAllowedOrgs, defaultTargetDevHub.value);
    suggestedUsername = foundOrg?.username;
    aliasForReference = foundOrg?.aliases?.[0];
    reasoning = `it is the default ${targetDevHubLocation}dev hub org`;
  } else {
    reasoning = 'Error: no org was inferred. Ask the user to specify one';
  }

  return {
    suggestedUsername,
    aliasForReference,
    reasoning,
  };
}

/*
 * Get username for Salesforce org
 *
 * Intelligently determines the appropriate username or alias for Salesforce operations.
 *
 * Parameters:
 * - defaultTargetOrg: Force lookup of default target org (optional)
 * - defaultDevHub: Force lookup of default dev hub (optional)
 * - directory: The directory to run this tool from
 *
 * Returns:
 * - textResponse: Username/alias and org configuration
 */

export const getUsernameParamsSchema = z.object({
  defaultTargetOrg: z.boolean().optional().default(false).describe(`Try to find default org
AGENT INSTRUCTIONS:
ONLY SET TO TRUE when the user explicitly asks for the default org or default target org.
Leave it as false when the user is vague and says something like "for my org" or "for my-alias".

USAGE EXAMPLE:
Get username for my default org
...for my default target org`),
  defaultDevHub: z.boolean().optional().default(false).describe(`Try to find default dev hub
AGENT INSTRUCTIONS:
ONLY SET TO TRUE when the user explicitly asks for the default dev hub or default target devhub.
Leave it as false when the user is vague and says something like "for my org" or "for my-alias".

USAGE EXAMPLE:
Get username for my default dev hub
...for my default target dev hub
...for my default devhub`),
  directory: directoryParam,
});

type InputArgs = z.infer<typeof getUsernameParamsSchema>;
type InputArgsShape = typeof getUsernameParamsSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class GetUsernameMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public constructor(private readonly services: Services) {
    super();
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.CORE];
  }

  public getName(): string {
    return 'sf-get-username';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Get Username',
      description: `Intelligently determines the appropriate username or alias for Salesforce operations.

AGENT/LLM INSTRUCTIONS:
Use this tool when uncertain which username/org a user wants for Salesforce operations.
This tool handles three distinct scenarios:

1. When defaultTargetOrg=true: Fetches the default target org configuration
   - Use when user says "for my default org" or "for my default target org"

2. When defaultDevHub=true: Fetches the default dev hub configuration
   - Use when user says "for my default dev hub" or "for my default target dev hub"

3. When both are false (default): Uses suggestUsername to intelligently determine the appropriate org
   - Use when user is vague and says something like "for my org" or doesn't specify

EXAMPLE USAGE:
- When user says "Do X for my org" → defaultTargetOrg=false, defaultDevHub=false
- When user says "For my default org" → defaultTargetOrg=true
- When user says "For my default dev hub" → defaultDevHub=true`,
      inputSchema: getUsernameParamsSchema.shape,
      outputSchema: undefined,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    try {
      process.chdir(input.directory);

      const generateResponse = (defaultFromConfig: OrgConfigInfo | undefined): ToolTextResponse =>
        textResponse(`ALWAYS notify the user the following 3 (maybe 4) pieces of information:
1. If it is default target-org or target-dev-hub ('.key' on the config)
2. The value of '.location' on the config
3. The value of '.value' on the config
4. IF '.cached' IS TRUE, tell then we are using a cached value and if they have changed it, restart the MCP Server

- Full config: ${JSON.stringify(defaultFromConfig, null, 2)}

UNLESS THE USER SPECIFIES OTHERWISE, use this username for the "usernameOrAlias" parameter in future Tool calls.`);

      const orgService = this.services.getOrgService();
      // Case 1: User explicitly asked for default target org
      if (input.defaultTargetOrg) return generateResponse(await orgService.getDefaultTargetOrg());

      // Case 2: User explicitly asked for default dev hub
      if (input.defaultDevHub) return generateResponse(await orgService.getDefaultTargetDevHub());

      // Case 3: User was vague, so suggest a username
      const { aliasForReference, suggestedUsername, reasoning } = await suggestUsername(orgService);

      if (!suggestedUsername) {
        return textResponse(
          "No suggested username found. Please specify a username or alias explicitly. Also check the MCP server's startup args for allowlisting orgs.",
          true
        );
      }

      return textResponse(`
YOU MUST inform the user that we are going to use "${suggestedUsername}" ${
        aliasForReference ? `(Alias: ${aliasForReference}) ` : ''
      }for the "usernameOrAlias" parameter.
YOU MUST explain the reasoning for selecting this org, which is: "${reasoning}"
UNLESS THE USER SPECIFIES OTHERWISE, use this username for the "usernameOrAlias" parameter in future Tool calls.`);
    } catch (error) {
      return textResponse(
        `Failed to determine appropriate username: ${error instanceof Error ? error.message : 'Unknown error'}`,
        true
      );
    }
  }
}
