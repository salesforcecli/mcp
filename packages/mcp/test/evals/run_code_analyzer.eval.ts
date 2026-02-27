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
import {fileURLToPath} from 'node:url';
import { describeEval } from 'vitest-evals';
import { TaskRunner } from './utils.js';

const fileName = fileURLToPath(import.meta.url);
const dirName = path.dirname(fileName);

const pathToTarget: string = path.join(dirName, '..', 'fixtures', 'sample-targets', 'SampleTarget1.cls');

describeEval('run_code_analyzer', {
    data: async () => [{
        input: `Run code analysis against ${pathToTarget}, and tell me the number of violations in that file using the response format "There are X violations".`,
        expected: [6]
    }],
    task: TaskRunner(),
    scorers: [(opts: {output: string; expected: number}) => {
        const score: number = opts.output === `There are ${opts.expected} violations.` ? 1 : 0;
        return {score};
    }],
    threshold: 0.9,
    timeout: 60_000
});