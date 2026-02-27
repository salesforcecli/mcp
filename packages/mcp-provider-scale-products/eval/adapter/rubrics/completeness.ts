/**
 * Completeness rubric (weight: 0.30)
 *
 * Measures whether all expected antipatterns were found with no omissions
 * and no false positives.
 */
export function completenessRubric(
  prompt: string,
  agentOutput: string,
  groundTruth: string
): string {
  return `You are an expert evaluator scoring an AI agent's response for COMPLETENESS.

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

**5 - Excellent**: Every expected antipattern instance found. No false positives. If the class is clean, the agent correctly states no issues found. Complete coverage of all antipattern types.

**4 - Good**: All antipattern types found but may be missing 1 instance within a type. No false positives. Clean classes correctly identified.

**3 - Adequate**: Most antipatterns found (>= 75% of expected instances). At most 1 false positive. Clean classes identified but with caveats.

**2 - Poor**: Fewer than 75% of expected antipatterns found. Multiple false positives reported. Or a clean class incorrectly flagged with issues.

**1 - Failing**: Most antipatterns missed (< 50% found). Many false positives. Clean class reported as having critical issues. Fundamentally incomplete analysis.

## Instructions
1. First, think step-by-step: count how many expected antipatterns the agent found vs. ground truth.
2. Check for any false positives (antipatterns reported that should not be there).
3. Then output your evaluation as JSON.

Output ONLY valid JSON in this exact format:
{"justification": "Your step-by-step reasoning here", "score": <1-5>}`;
}
