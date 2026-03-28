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
import { TaskRunner, outputIncludesExpectationArray } from './utils.js';

describeEval('describe_code_analyzer_rule', {
    data: async () => [{
        input: 'tell me the tags that are associated with the Code Analysis Rule named VFUnescapeEl, which is a rule for the pmd engine',
        expected: ['Recommended', 'Security', 'Visualforce']
    }],
    task: TaskRunner(),
    scorers: [outputIncludesExpectationArray],
    threshold: 0.9,
    timeout: 60_000
});