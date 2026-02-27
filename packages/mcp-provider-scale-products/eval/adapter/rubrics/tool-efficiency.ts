/**
 * Tool Efficiency rubric (weight: 0.20)
 *
 * Measures whether the agent selected the correct tool, used it with
 * proper parameters, and minimized unnecessary tool calls.
 */
export function toolEfficiencyRubric(
  prompt: string,
  agentOutput: string,
  groundTruth: string
): string {
  return `You are an expert evaluator scoring an AI agent's TOOL EFFICIENCY.

## Task
The agent was given this prompt:
<prompt>
${prompt}
</prompt>

The agent produced this output (including tool call metadata):
<agent_output>
${agentOutput}
</agent_output>

The ground truth is:
<ground_truth>
${groundTruth}
</ground_truth>

## Context
The agent has access to the tool "scan_apex_class_for_antipatterns" which requires:
- className: Name of the Apex class
- apexFilePath: Absolute path to the .cls file
- directory: Working directory (absolute path)

The agent should invoke this tool to perform the scan. Minimal tool calls are preferred.

## Scoring Rubric (1-5)

**5 - Excellent**: Correct tool selected on first attempt. All required parameters provided correctly (className, apexFilePath, directory). No unnecessary tool calls. Completed in 1-2 total tool calls.

**4 - Good**: Correct tool selected. Parameters mostly correct (minor formatting differences). At most 1 unnecessary tool call. Completed in 2-3 total tool calls.

**3 - Adequate**: Correct tool eventually selected (may have tried wrong tool first). Parameters required minor correction. 3-4 total tool calls.

**2 - Poor**: Wrong tool selected initially, multiple retries needed. Parameters incorrect requiring correction. 5+ total tool calls. Significant inefficiency.

**1 - Failing**: Never invoked the correct tool. Or invoked it with fundamentally wrong parameters. Or excessive tool calls (>6) without reaching a valid result.

## Instructions
1. First, think step-by-step: identify which tools were called and in what order.
2. Check if the scan tool was called with correct parameters.
3. Count total tool calls and assess efficiency.
4. Then output your evaluation as JSON.

Output ONLY valid JSON in this exact format:
{"justification": "Your step-by-step reasoning here", "score": <1-5>}`;
}
