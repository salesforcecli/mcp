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
import { McpTool, McpToolConfig, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { textResponse } from '../shared/utils.js';
import { directoryParam, usernameOrAliasParam } from '../shared/params.js';

const orgOpenParamsSchema = z.object({
  filePath: z
    .string()
    .optional()
    .describe('File path of the metadata to open. This should be an existent file path in the project.'),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

type InputArgs = z.infer<typeof orgOpenParamsSchema>;
type InputArgsShape = typeof orgOpenParamsSchema.shape;
type OutputArgsShape = z.ZodRawShape;

export class OrgOpenMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public getToolsets(): Toolset[] {
    return [Toolset.EXPERIMENTAL];
  }

  public getName(): string {
    return 'sf-org-open';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Open Org in Browser',
      description: `Open a Salesforce org in the browser.

You can specify a metadata file you want to open.`,
      inputSchema: orgOpenParamsSchema.shape,
      outputSchema: undefined,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
      },
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    process.chdir(input.directory);

    const org = await Org.create({
      aliasOrUsername: input.usernameOrAlias,
    });

    if (input.filePath) {
      const metadataResolver = new MetadataResolver();
      const components = metadataResolver.getComponentsFromPath(input.filePath);
      const typeName = components[0]?.type?.name;

      const metadataBuilderUrl = await org.getMetadataUIURL(typeName, input.filePath);
      await open(metadataBuilderUrl);

      return textResponse(
        metadataBuilderUrl.includes('FlexiPageList')
          ? "Opened the org in your browser. This metadata file doesn't have a builder UI, opened Lightning App Builder instead."
          : 'Opened this metadata in your browser'
      );
    }

    await open(await org.getFrontDoorUrl());

    return textResponse('Opened the org in your browser.');
  }
}
