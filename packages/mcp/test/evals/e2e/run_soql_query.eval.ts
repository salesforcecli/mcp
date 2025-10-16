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
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { describeEval, ToolCallScorer } from 'vitest-evals';
import { TaskRunner } from '../utils/runners.js';
import { Factuality } from '../utils/scorers/factuality.js';

let testSession: TestSession;
let orgUsername: string;
let projectDir: string;

beforeAll(async () => {
  testSession = await TestSession.create({
    project: { gitClone: 'https://github.com/trailheadapps/dreamhouse-lwc' },
    scratchOrgs: [{ setDefault: true, config: path.join('config', 'project-scratch-def.json') }],
    devhubAuthStrategy: 'AUTO',
  });

  projectDir = testSession.project.dir;

  await execCmd('project deploy start', {
    cli: 'sf',
    ensureExitCode: 0,
    async: true,
  });

  await execCmd('org assign permset -n dreamhouse', {
    cli: 'sf',
    ensureExitCode: 0,
    async: true,
  });

  await execCmd(`data tree import -p ${path.join(testSession.project.dir, 'data', 'sample-data-plan.json')}`, {
    cli: 'sf',
    ensureExitCode: 0,
    async: true,
  });

  // get default scratch org username
  orgUsername = [...testSession.orgs.keys()][0];
}, 600_000);

afterAll(async () => {
  await testSession.clean();
});

describeEval('SOQL queries', {
  data: async () => [
    {
      input: 'List the name of the Property__c records in my org, ordered in ascending order by their name.',
      expected: `The response should include these records:
Architectural Details
City Living
Contemporary City Living
Contemporary Luxury
Heart of Harvard Square
Modern City Living
Quiet Retreat
Seaport District Retreat
Stunning Colonial
Stunning Victorian
Ultimate Sophistication
Waterfront in the City
`,
      // IMPORTANT:
      // Get expected tools data at runtime rather than at module initialization time to be able to access
      // test session context (set in the beforeAll hook).
      //
      // This is needed because `projectDir` and `orgUsername` are not initialized when declared, so we want to
      // read them at test runtime.
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
            name: 'run_soql_query',
            arguments: {
              query: 'SELECT Name FROM Property__c ORDER BY Name ASC',
              usernameOrAlias: orgUsername,
              directory: projectDir,
            },
          },
        ];
      })(),
    },
  ],
  // IMPORTANT:
  // Create the task runner at runtime rather than at module initialization time to be able to access
  // test session context (set in the beforeAll hook).
  task: (input: string) =>
    TaskRunner({
      promptOptions: {
        // not needed for this test
        currentOpenFile: '',
        currentOpenWorkspace: projectDir,
      },
    })(input),
  scorers: [
    Factuality(),
    ToolCallScorer({
      ordered: true,
      // fuzzy to account for possible SOQL query diffs agains the expected query (different clauses, casing, etc)
      params: 'fuzzy',
    }),
  ],
  threshold: 0.8,
  timeout: 300_000,
});
