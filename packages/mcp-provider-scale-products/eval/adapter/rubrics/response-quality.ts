/**
 * Response Quality rubric (weight: 0.15)
 *
 * Measures the clarity, actionability, and formatting of the agent's
 * final response to the user.
 */
export function responseQualityRubric(
  prompt: string,
  agentOutput: string,
  groundTruth: string
): string {
  return `You are an expert evaluator scoring an AI agent's RESPONSE QUALITY.

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

**5 - Excellent**: Response is clear, well-structured, and immediately actionable. Antipatterns are presented in an organized manner (grouped by type). Severity is visually indicated. Fix instructions are clear and specific. Easy to scan and understand at a glance.

**4 - Good**: Response is clear and actionable. Antipatterns are organized. Severity is mentioned. Fix guidance is provided but may lack specificity. Minor formatting improvements possible.

**3 - Adequate**: Response communicates the findings but organization could be better. Severity and fixes are mentioned but not prominently. Some effort needed to extract actionable information.

**2 - Poor**: Response is hard to follow. Findings are buried or disorganized. Severity or fix information is missing. User would struggle to act on the results.

**1 - Failing**: Response is unintelligible, empty, or an error message. No useful information about antipatterns. User cannot act on the response at all.

## Instructions
1. First, think step-by-step about the quality of the agent's response from a user's perspective.
2. Consider: Is it easy to read? Are findings organized? Is severity clear? Are fixes actionable?
3. Then output your evaluation as JSON.

Output ONLY valid JSON in this exact format:
{"justification": "Your step-by-step reasoning here", "score": <1-5>}`;
}
