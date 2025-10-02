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
import { ToolPredictionScorer } from '../utils/toolPredictionScorer.js';
import { NoOpTaskRunner } from './utils.js';

describeEval('deploy', {
  data: async () => [
    {
      input: 'Deploy this file to my default org and run all apex tests in deployment',
      expectedTools: [
        {
          name: 'get_username',
          arguments: {
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
            defaultTargetOrg: true
          },
        },
        {
          name: 'deploy_metadata',
          arguments: {
            sourceDir: [process.env.SF_EVAL_PROMPT_OPEN_FILEPATH],
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
            apexTestLevel: 'RunAllTestsInOrg',
            usernameOrAlias: "ebikes-default-org"
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
            sourceDir: [process.env.SF_EVAL_PROMPT_OPEN_FILEPATH],
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
            apexTests: ['GeocodingServiceTest']
            // apexTestLevel: 'RunAllTestsInOrg',
          },
        },
      ],
    },
    {
      input: 'Deploy this file and run the GeocodingServiceTest tests',
      expectedTools: [
        {
          name: 'get_username',
          arguments: {
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
            // TODO: can we do a "fuzzy" match per tool param?
            // defaultTargetOrg: true
          },
        },
        {
          name: 'deploy_metadata',
          arguments: {
            sourceDir: [process.env.SF_EVAL_PROMPT_OPEN_FILEPATH],
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
            apexTests: ['GeocodingServiceTest']
            // apexTestLevel: 'RunAllTestsInOrg',
          },
        },
      ],
    }
  ],
  task: NoOpTaskRunner(),
  scorers: [ToolPredictionScorer()],
  // TODO(cristian): revise this based on how flexible our params are around get_username and document default
  threshold: 1.0,
  timeout: 30_000,
});
