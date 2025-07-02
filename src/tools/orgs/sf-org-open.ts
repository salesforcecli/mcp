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
import { Org } from '@salesforce/core';
import { MetadataResolver } from '@salesforce/source-deploy-retrieve';
import open from 'open';
import { textResponse } from '../../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';
import { SfMcpServer } from '../../sf-mcp-server.js';

export const orgOpenParamsSchema = z.object({
  filePath: z.string().optional().describe('File path of the metadata to open.'),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

export type OrgOpenParamsSchema = z.infer<typeof orgOpenParamsSchema>;

export const registerToolOrgOpen = (server: SfMcpServer): void => {
  server.tool(
    'sf-org-open',
    `Open a Salesforce org in the browser.

You can specify a metadata file you want to open.
`,
    orgOpenParamsSchema.shape,
    {
      title: 'Open Org in browser',
      readOnlyHint: true,
      openWorldHint: false,
    },
    async ({ usernameOrAlias, filePath, directory }) => {
      process.chdir(directory);

      const org = await Org.create({
        aliasOrUsername: usernameOrAlias,
      });

      if (filePath) {
        const metadataResolver = new MetadataResolver();
        const components = metadataResolver.getComponentsFromPath(filePath);
        const typeName = components[0]?.type?.name;

        const metadataBuilderUrl = await org.getMetadataBuilderUrl(typeName, filePath);
        await open(metadataBuilderUrl);

        return textResponse(
          `Successfully opened the org in your browser. ${
            metadataBuilderUrl.includes('FlexiPageList')
              ? "This metadata file doesn't have a builder UI, opened Lightning App Builder instead."
              : ''
          }`
        );
      }

      await open(await org.getFrontDoorUrl());

      return textResponse('Successfully opened the org in your browser.');
    }
  );
};
