import { describeEval } from 'vitest-evals';
import { TaskRunner } from '../utils/runners.js';

describeEval('describe_code_analyzer_rule', {
  data: async () => [
    {
      input:
        'tell me the tags that are associated with the Code Analysis Rule named VFUnescapeEl, which is a rule for the pmd engine',
      expected: ['Recommended', 'Security', 'Visualforce'],
    },
  ],
  task: TaskRunner(),
  scorers: [outputIncludesExpectationArray],
  threshold: 0.9,
  timeout: 60_000,
});

export function outputIncludesExpectationArray(opts: { input: string; output: string; expected: string[] }) {
  let score: number = 0;
  //console.log(`output is ${opts.output}`);
  const increment: number = 1 / opts.expected.length;
  for (const expected of opts.expected) {
    if (opts.output.toLowerCase().includes(expected.toLowerCase())) {
      //console.log(`contained ${expected}, icnrementing`);
      score += increment;
    }
    //console.log(`score is now ${score}`)
  }
  return {
    score,
  };
}
