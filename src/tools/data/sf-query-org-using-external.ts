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

import { getConnection } from '../../shared/auth.js';
import { directoryParam, usernameOrAliasParam, useToolingApiParam } from '../../shared/params.js';
import { SfMcpServer } from '../../sf-mcp-server.js';
import {
  queryOrgDescription,
  queryOrgAnnotations,
  queryOrgExecutable,
  queryOrgParamsSchema as queryOrgParamsSchemaExternal,
} from '../EXTERNAL/external-tool-query-org.js';

export const queryOrgParamsSchema = z.object({
  // Shared parameters (used only in tool setup)
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
  // Shared parameters (passed through to external tool)
  useToolingApi: useToolingApiParam,
  // External tool parameters (passed through to external tool)
  query: queryOrgParamsSchemaExternal.shape.query,
});

export type QueryOrgOptions = z.infer<typeof queryOrgParamsSchema>;

export const registerToolQueryOrg = (server: SfMcpServer): void => {
  server.tool(
    'sf-query-org',
    `${queryOrgDescription}

    EXAMPLES:
    ...query Contacts that have a Phone listed
    ...find the 3 newest Property__c records`,
    queryOrgParamsSchema.shape,
    queryOrgAnnotations,
    async ({ directory, usernameOrAlias, query, useToolingApi }) => {
      process.chdir(directory);
      const connection = await getConnection(usernameOrAlias);

      const passThroughParams = {
        query,
        useToolingApi,
      };

      const passThroughConfig = {
        connection,
      };

      return queryOrgExecutable(passThroughParams, passThroughConfig);
    }
  );
};
