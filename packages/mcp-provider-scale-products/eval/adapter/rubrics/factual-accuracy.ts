/**
 * Factual Accuracy rubric (weight: 0.35)
 *
 * Measures whether the agent correctly identifies antipattern types,
 * severities, and line numbers that match the ground truth.
 */
export function factualAccuracyRubric(
  prompt: string,
  agentOutput: string,
  groundTruth: string
): string {
  return `You are an expert evaluator scoring an AI agent's response for FACTUAL ACCURACY.

## Task
The agent was given this prompt:
<prompt>
${prompt}
</prompt>

The agent produced this output:
<agent_output>
${agentOutput}
</agent_output>

The ground truth is:
<ground_truth>
${groundTruth}
</ground_truth>

## Scoring Rubric (1-5)

**5 - Excellent**: All antipattern types correctly identified. Severities match ground truth exactly. Line numbers are accurate. No factual errors in the response.

**4 - Good**: All antipattern types correctly identified. Minor discrepancies in severity or line numbers (off by 1-2 lines). No incorrect antipattern types reported.

**3 - Adequate**: Most antipattern types correctly identified (missing 1). Severities mostly correct. Some line number inaccuracies. No fabricated antipatterns.

**2 - Poor**: Significant factual errors. Multiple antipattern types missed or incorrectly identified. Wrong severities reported. Line numbers substantially wrong.

**1 - Failing**: Most or all antipatterns missed. Fabricated antipatterns reported. Fundamentally incorrect analysis. Output does not reflect the actual code.

## Instructions
1. First, think step-by-step about the factual accuracy of the agent's response compared to the ground truth.
2. Consider: Are the antipattern types correct? Are the severities correct? Are line numbers reasonable?
3. Then output your evaluation as JSON.

Output ONLY valid JSON in this exact format:
{"justification": "Your step-by-step reasoning here", "score": <1-5>}`;
}
