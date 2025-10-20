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
import path from 'node:path';
import { afterAll, beforeAll } from 'vitest';
import { TestSession } from '@salesforce/cli-plugins-testkit';
import { describeEval, ToolCallScorer } from 'vitest-evals';
import { TaskRunner } from '../utils/runners.js';
import { Factuality } from '../utils/scorers/factuality.js';

let testSession: TestSession;
let orgUsername: string;
let projectDir: string;
let currentOpenFile: string;

beforeAll(async () => {
  testSession = await TestSession.create({
    project: { gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc' },
    scratchOrgs: [{ setDefault: true, config: path.join('config', 'project-scratch-def.json') }],
    devhubAuthStrategy: 'AUTO',
  });

  projectDir = testSession.project.dir;
  currentOpenFile = path.join(projectDir, 'force-app', 'main', 'default', 'classes', 'GeocodingServiceTest.cls');

  // get default scratch org username
  orgUsername = [...testSession.orgs.keys()][0];
}, 600_000);

afterAll(async () => {
  await testSession.clean();
});

describeEval('deploy_metadata', {
  data: async () => [
    {
      input:
        'Deploy this project and run all Apex tests, then assign the dreamhouse permset and summarize the apex test results.',
      expected: 'It should have successfully deployed the project and executed all 11 tests without failures',
      expectedTools: (() => {
        [
          {
            name: 'get_username',
            arguments: {
              defaultTargetOrg: true,
              defaultDevHub: false,
              directory: projectDir,
            },
          },
          {
            name: 'deploy_metadata',
            arguments: {
              apexTestLevel: 'RunAllTestsInOrg',
              usernameOrAlias: orgUsername,
              directory: projectDir,
            },
          },
          {
            name: 'assign_permission_set',
            arguments: {
              permissionSetName: 'dreamhouse',
              usernameOrAlias: orgUsername,
              directory: projectDir,
            },
          },
        ];
      })(),
    },
    {
      input: 'Deploy this file and run the GeocodingServiceTest tests, then summarize the apex test results.',
      expected:
        'It should have deployed 1 component (GeocodingServiceTest class) and successfully executed the "GeocodingServiceTest.successResponse", "GeocodingServiceTest.blankAddress" and "GeocodingServiceTest.errorResponse" tests.',
      expectedTools: (() => {
        [
          {
            name: 'get_username',
            arguments: {
              defaultTargetOrg: true,
              defaultDevHub: false,
              directory: projectDir,
            },
          },
          {
            name: 'deploy_metadata',
            arguments: {
              apexTestLevel: 'RunAllTestsInOrg',
              apexTests: ['GeocodingServiceTest'],
              sourceDir: [currentOpenFile],
              usernameOrAlias: orgUsername,
              directory: projectDir,
            },
          },
        ];
      })(),
    },
  ],
  task: (input: string) =>
    TaskRunner({
      promptOptions: {
        currentOpenFile,
        currentOpenWorkspace: projectDir,
      },
    })(input),
  scorers: [
    Factuality(),
    ToolCallScorer({
      ordered: true,
      params: 'strict',
    }),
  ],
  threshold: 0.8,
  timeout: 600_000,
});
