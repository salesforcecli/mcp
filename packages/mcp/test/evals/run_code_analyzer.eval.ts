import path from "node:path";
import {fileURLToPath} from "node:url";
import { describeEval } from 'vitest-evals';
import { TaskRunner } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pathToTarget: string = path.join(__dirname, '..', 'fixtures', 'sample-targets', 'SampleTarget1.cls');

describeEval('run_code_analyzer', {
    data: async () => [{
        input: `Run code analysis against ${pathToTarget}, and tell me the number of violations in that file using the response format "There are X violations".` ,
        expected: [6]
    }],
    task: TaskRunner(),
    scorers: [(opts: {output: string, expected: number}) => {
        const score: number = opts.output === `There are ${opts.expected} violations.` ? 1 : 0;
        return {score};
    }],
    threshold: 0.9,
    timeout: 60_000
});