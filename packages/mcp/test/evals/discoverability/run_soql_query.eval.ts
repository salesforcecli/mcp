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

describeEval('run_soql_query', {
  data: async () => [
    {
      input: 'List the name of the Property__c records in my org, ordered in ascending order by their name.',
      expectedTools: [
        {
          name: 'run_soql_query',
          arguments: {
            query: 'SELECT Name FROM Property__c ORDER BY Name ASC',
            usernameOrAlias: 'ebikes',
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
          },
        },
      ],
    },
    {
      input: 'Get the coverage of the GeocodingService apex class, you can query the ApexCodeCoverage tooling object',
      expectedTools: [
        {
          name: 'run_soql_query',
          arguments: {
            usernameOrAlias: 'ebikes',
            query: 'SELECT Coverage FROM ApexCodeCoverage WHERE ApexClassOrTriggerId = ‘01pD000000066GR’',
            useToolingApi: true,
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
