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

describeEval('', {
  data: async () => [
    {
      input: 'Run the GeocodingServiceTest and FileUtilitiesTest tests in the dreamhouse org',
      expectedTools: [
        {
          name: 'run_apex_test',
          arguments: {
            usernameOrAlias: 'dreamhouse',
            classNames: ['GeocodingServiceTest', 'FileUtilitiesTest'],
            testLevel: 'RunSpecifiedTests',
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
          },
        },
      ],
    },
    {
      input: 'Run all apex tests in the org',
      expectedTools: [
        {
          name: 'get_username',
          arguments: {
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
            defaultTargetOrg: true,
          },
        },
        {
          name: 'run_apex_test',
          arguments: {
            usernameOrAlias: 'default-org',
            testLevel: 'RunAllTestsInOrg',
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
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
