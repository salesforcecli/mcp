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
import { Connection, Org, SfProject } from '@salesforce/core';
import { SourceTracking } from '@salesforce/source-tracking';
import { ComponentSet, ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { ensureString } from '@salesforce/ts-types';
import { Duration } from '@salesforce/kit';
import { McpTool, McpToolConfig, ReleaseState, Services, Toolset } from '@salesforce/mcp-provider-api';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { directoryParam, usernameOrAliasParam } from '../shared/params.js';
import { textResponse } from '../shared/utils.js';

/*
 * Retrieve metadata from an org to your local project.
 *
 * Parameters:
 * - sourceDir: Path to the local source files to retrieve.
 * - manifest: Full file path for manifest (XML file) of components to retrieve.
 * - usernameOrAlias: Username or alias of the Salesforce org to retrieve from.
 * - directory: Directory of the local project.
 *
 * Returns:
 * - textResponse: Retrieve result.
 */

export const retrieveMetadataParams = z.object({
  sourceDir: z
    .array(z.string())
    .describe(
      'Path to the local source files to retrieve. Leave this unset if the user is vague about what to retrieve.'
    )
    .optional(),
  manifest: z.string().describe('Full file path for manifest (XML file) of components to retrieve.').optional(),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

type InputArgs = z.infer<typeof retrieveMetadataParams>;
type InputArgsShape = typeof retrieveMetadataParams.shape;
type OutputArgsShape = z.ZodRawShape;

export class RetrieveMetadataMcpTool extends McpTool<InputArgsShape, OutputArgsShape> {
  public constructor(private readonly services: Services) {
    super();
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.METADATA];
  }

  public getName(): string {
    return 'retrieve_metadata';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Retrieve Metadata',
      description: `Retrieve metadata from an org to your local project.

AGENT INSTRUCTIONS:
If the user doesn't specify what to retrieve exactly ("retrieve my changes"), leave the "sourceDir" and "manifest" params empty so the tool calculates which files to retrieve.

EXAMPLE USAGE:
Retrieve changes
Retrieve changes from my org
Retrieve this file from my org
Retrieve the metadata in the manifest
Retrieve X metadata from my org`,
      inputSchema: retrieveMetadataParams.shape,
      outputSchema: undefined,
      annotations: {
        openWorldHint: false,
        destructiveHint: true,
      },
    };
  }

  public async exec(input: InputArgs): Promise<CallToolResult> {
    if (input.sourceDir && input.manifest) {
      return textResponse("You can't specify both `sourceDir` and `manifest` parameters.", true);
    }

    if (!input.usernameOrAlias)
      return textResponse(
        'The usernameOrAlias parameter is required, if the user did not specify one use the #get_username tool',
        true
      );

    // needed for org allowlist to work
    process.chdir(input.directory);

    const connection = await this.services.getOrgService().getConnection(input.usernameOrAlias);
    const project = await SfProject.resolve(input.directory);

    const org = await Org.create({ connection });

    if (!input.sourceDir && !input.manifest && !(await org.tracksSource())) {
      return textResponse(
        'This org does not have source-tracking enabled or does not support source-tracking. You should specify the files or a manifest to retrieve.',
        true
      );
    }

    try {
      const stl = await SourceTracking.create({
        org,
        project,
        subscribeSDREvents: true,
      });

      const componentSet = await buildRetrieveComponentSet(connection, project, stl, input.sourceDir, input.manifest);

      if (componentSet.size === 0) {
        // STL found no changes
        return textResponse('No remote changes to retrieve were found.');
      }

      const retrieve = await componentSet.retrieve({
        usernameOrConnection: connection,
        merge: true,
        format: 'source',
        output: project.getDefaultPackage().fullPath,
      });

      // polling freq. is set dynamically by SDR based no the component set size.
      const result = await retrieve.pollStatus({
        timeout: Duration.minutes(10),
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { zipFile, ...retrieveResult } = result.response;

      return textResponse(`Retrieve result: ${JSON.stringify(retrieveResult)}`, !retrieveResult.success);
      // }
    } catch (error) {
      return textResponse(
        `Failed to retrieve metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
        true
      );
    }
  }
}

async function buildRetrieveComponentSet(
  connection: Connection,
  project: SfProject,
  stl: SourceTracking,
  sourceDir?: string[],
  manifestPath?: string
): Promise<ComponentSet> {
  if (sourceDir || manifestPath) {
    return ComponentSetBuilder.build({
      apiversion: connection.getApiVersion(),
      sourceapiversion: ensureString((await project.resolveProjectConfig()).sourceApiVersion),
      sourcepath: sourceDir,
      ...(manifestPath
        ? {
            manifest: {
              manifestPath,
              directoryPaths: project.getUniquePackageDirectories().map((pDir) => pDir.fullPath),
            },
          }
        : {}),
      projectDir: project.getPath(),
    });
  }

  // No specific metadata requested to retrieve, build component set from STL.
  const cs = await stl.maybeApplyRemoteDeletesToLocal(true);
  return cs.componentSetFromNonDeletes;
}
