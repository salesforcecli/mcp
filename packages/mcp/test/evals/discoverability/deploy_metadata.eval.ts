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
import { describeEval } from 'vitest-evals';
import { NoOpTaskRunner } from '../utils/runners.js';
import { ToolPredictionScorer } from '../utils/scorers/toolPredictionScorer.js';

describeEval('deploy', {
  data: async () => [
    {
      input: 'Deploy this file to my default org and run all apex tests in deployment',
      expectedTools: [
        {
          name: 'get_username',
          arguments: {
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
            defaultTargetOrg: true,
          },
        },
        {
          name: 'deploy_metadata',
          arguments: {
            sourceDir: [process.env.SF_EVAL_PROMPT_OPEN_FILEPATH],
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
            apexTestLevel: 'RunAllTestsInOrg',
            usernameOrAlias: 'ebikes-default-org',
          },
        },
      ],
    },
    {
      input: 'Deploy this project to my ebikes org',
      expectedTools: [
        {
          name: 'deploy_metadata',
          arguments: {
            usernameOrAlias: 'ebikes',
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
          },
        },
      ],
    },
    {
      input: 'Deploy this file and run the GeocodingServiceTest tests',
      expectedTools: [
        {
          // user doesn't specify which org to deploy to -> discover it via `get_username`
          name: 'get_username',
          arguments: {
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
            defaultTargetOrg: true,
          },
        },
        {
          name: 'deploy_metadata',
          arguments: {
            usernameOrAlias: 'default-org',
            sourceDir: [process.env.SF_EVAL_PROMPT_OPEN_FILEPATH],
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
            // IMPORTANT: there's a `run_apex_test` available but for these "run test during deployment" scenarios we want to ensure they are only run via `deploy_metadata`, it's a pretty common operation for an agentic loop (test failures rollback deployment)
            apexTests: ['GeocodingServiceTest'],
          },
        },
      ],
    },
  ],
  task: NoOpTaskRunner(),
  scorers: [ToolPredictionScorer()],
  threshold: 1.0,
  timeout: 30_000,
});
