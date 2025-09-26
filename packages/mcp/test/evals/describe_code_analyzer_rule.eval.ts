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