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
import { Factuality, TaskRunner } from './utils.js';

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
      //         expected: `The response should include these records:
      // Sophisticated Urban Escape
      // Metropolitan Elegance
      // Vibrant City Sanctuary
      // Downtown Dreamscape
      // Sleek Urban Oasis
      // Modern Metropole
      // Luxe in the Loop
      // `,
    },
  ],
  task: TaskRunner(),
  scorers: [Factuality()],
  threshold: 0.6,
  timeout: 30_000,
});
