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

import { Connection, Org, SfError, SfProject } from '@salesforce/core';
import { SourceTracking } from '@salesforce/source-tracking';
import { ComponentSet, ComponentSetBuilder } from '@salesforce/source-deploy-retrieve';
import { ensureString } from '@salesforce/ts-types';
import { Duration } from '@salesforce/kit';
import { directoryParam, usernameOrAliasParam } from '../../shared/params.js';
import { textResponse } from '../../shared/utils.js';
import { getConnection } from '../../shared/auth.js';
import { SfMcpServer } from '../../sf-mcp-server.js';

const deployMetadataParams = z.object({
  sourceDir: z
    .array(z.string())
    .describe('Path to the local source files to deploy. Leave this unset if the user is vague about what to deploy.')
    .optional(),
  manifest: z.string().describe('Full file path for manifest (XML file) of components to deploy.').optional(),
  // `RunSpecifiedTests` is excluded on purpose because the tool sets this level when Apex tests to run are passed in.
  //
  // Can be left unset to let the org decide which test level to use:
  // https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy_running_tests.htm
  apexTestLevel: z
    .enum(['NoTestRun', 'RunLocalTests', 'RunAllTestsInOrg'])
    .optional()
    .describe(
      `Apex test level to use during deployment.

AGENT INSTRUCTIONS
Set this only if the user specifically ask to run apex tests in some of these ways:

NoTestRun="No tests are run"
RunLocalTests="Run all tests in the org, except the ones that originate from installed managed and unlocked packages."
RunAllTestsInOrg="Run all tests in the org, including tests of managed packages"

Don't set this param if "apexTests" is also set.
`
    ),
  apexTests: z
    .array(z.string())
    .describe(
      `Apex tests classes to run.

Set this param if the user ask an Apex test to be run during deployment.
`
    )
    .optional(),
  usernameOrAlias: usernameOrAliasParam,
  directory: directoryParam,
});

export type DeployMetadata = z.infer<typeof deployMetadataParams>;

/*
 * Deploy metadata to a Salesforce org.
 *
 * Parameters:
 * - sourceDir: Path to the local source files to deploy.
 * - manifest: Full file path for manifest (XML file) of components to deploy.
 * - apexTestLevel: Apex test level to use during deployment.
 * - apexTests: Apex tests classes to run.
 * - usernameOrAlias: Username or alias of the Salesforce org to deploy to.
 * - directory: Directory of the local project.
 *
 * Returns:
 * - textResponse: Deploy result.
 */
export const deployMetadata = (server: SfMcpServer): void => {
  server.tool(
    'sf-deploy-metadata',
    `Deploy metadata to an org from your local project.

AGENT INSTRUCTIONS:
If the user doesn't specify what to deploy exactly ("deploy my changes"), leave the "sourceDir" and "manifest" params empty so the tool calculates which files to deploy.

EXAMPLE USAGE:
Deploy changes to my org
Deploy this file to my org
Deploy the manifest
Deploy X metadata to my org
Deploy X to my org and run A,B and C apex tests.
`,
    deployMetadataParams.shape,
    {
      title: 'Deploy Metadata',
      destructiveHint: true,
      openWorldHint: false,
    },
    async ({ sourceDir, usernameOrAlias, apexTests, apexTestLevel, directory, manifest }) => {
      if (apexTests && apexTestLevel) {
        return textResponse("You can't specify both `apexTests` and `apexTestLevel` parameters.", true);
      }

      if (sourceDir && manifest) {
        return textResponse("You can't specify both `sourceDir` and `manifest` parameters.", true);
      }

      if (!usernameOrAlias)
        return textResponse(
          'The usernameOrAlias parameter is required, if the user did not specify one use the #sf-get-username tool',
          true
        );

      // needed for org allowlist to work
      process.chdir(directory);

      const connection = await getConnection(usernameOrAlias);
      const project = await SfProject.resolve(directory);

      const org = await Org.create({ connection });

      if (!sourceDir && !manifest && !(await org.tracksSource())) {
        return textResponse(
          'This org does not have source-tracking enabled or does not support source-tracking. You should specify the files or a manifest to deploy.',
          true
        );
      }

      let jobId: string = '';
      try {
        const stl = await SourceTracking.create({
          org,
          project,
          subscribeSDREvents: true,
        });

        const componentSet = await buildDeployComponentSet(connection, project, stl, sourceDir, manifest);

        if (componentSet.size === 0) {
          // STL found no changes
          return textResponse('No local changes to deploy were found.');
        }

        const deploy = await componentSet.deploy({
          usernameOrConnection: connection,
          apiOptions: {
            ...(apexTests ? { runTests: apexTests, testLevel: 'RunSpecifiedTests' } : {}),
            ...(apexTestLevel ? { testLevel: apexTestLevel } : {}),
          },
        });
        jobId = deploy.id ?? '';

        // polling freq. is set dynamically by SDR based on the component set size.
        const result = await deploy.pollStatus({
          timeout: Duration.minutes(10),
        });

        return textResponse(`Deploy result: ${JSON.stringify(result.response)}`, !result.response.success);
      } catch (error) {
        const err = SfError.wrap(error);
        if (err.message.includes('timed out')) {
          return textResponse(
            `
YOU MUST inform the user that the deploy timed out and if they want to resume the deploy, they can use the #sf-resume tool
and ${jobId} for the jobId parameter.`,
            true
          );
        }
        return textResponse(`Failed to deploy metadata: ${err.message}`, true);
      }
    }
  );
};

async function buildDeployComponentSet(
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
      projectDir: stl?.projectPath,
    });
  }

  // No specific metadata requested to deploy, build component set from STL.
  const cs = (await stl.localChangesAsComponentSet(false))[0] ?? new ComponentSet(undefined, stl.registry);
  return cs;
}
