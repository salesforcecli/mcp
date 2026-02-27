# MCP Eval Framework — Onboarding Guide

## 1. What is this?

`@salesforce/mcp-eval-framework` is a generic agent evaluation framework for MCP tools. It tests whether an LLM agent (Claude Code CLI) correctly selects your tool, passes the right parameters, and produces correct output — using **Claude Code CLI as the agent under test** and **Claude as the LLM-as-judge**.

You supply test cases (YAML), fixture files, and a one-file adapter that captures your domain's scoring logic. The framework handles everything else: spawning the agent, parsing stream-json output, running the judge, and writing reports.

---

## 2. How it works

```
Your test case YAML
     │
     ▼
EvalRunner ──► Claude CLI (your MCP loaded) ──► stream-json output
     │                                                  │
     ▼                                                  ▼
YourAdapter.evaluateEndState ◄──── ParsedAgentOutput ◄─┘
     │
     ▼
JudgeEvaluator ──► Claude CLI (no tools, judge mode) ──► rubric scores
     │
     ▼
ConsoleReporter + JsonReporter
```

The **EvalAdapter** is the single extension point. Implement it once per MCP provider.

---

## 3. Quick Start (5 steps)

### Step 1 — Add dependency

```json
// your-package/package.json devDependencies
"@salesforce/mcp-eval-framework": "*"
```

Then run `yarn install`.

### Step 2 — Write your adapter

Create `eval/adapter/index.ts` implementing `EvalAdapter`:

```typescript
import type { EvalAdapter, TestCase, ParsedAgentOutput, ToolEfficiencyConfig, DomainEndStateResult } from '@salesforce/mcp-eval-framework';

export const myToolAdapter: EvalAdapter = {
  toolName: 'my_mcp_tool',
  allowedToolsPattern: 'mcp__my-server__*',

  resolvePromptPlaceholders(testCase, filePath, directory) {
    return {};  // add extra {placeholder} → value mappings if your prompts need them
  },

  evaluateEndState(output, rawOutput, expected, config) {
    const toolCalled = output.toolCalls.some(tc => tc.toolName.includes('my_mcp_tool'));
    const callCount = output.toolCalls.filter(tc => tc.toolName.includes('my_mcp_tool')).length;
    const maxCalls = config.maxToolCalls ?? 2;
    // ... your domain-specific correctness checks ...
    return {
      toolSelected: toolCalled,
      toolCallCount: callCount,
      toolCallCountWithinMax: callCount <= maxCalls,
      pass: toolCalled && callCount <= maxCalls /* && your checks */,
      details: { /* any extra info for formatEndStateDetails */ },
    };
  },

  formatGroundTruth(expected) {
    return `Expected output: ${JSON.stringify(expected)}`;
  },

  formatEndStateDetails(result) {
    return [`My detail: ${JSON.stringify(result.details)}`];
  },

  rubrics: {
    factualAccuracy: (prompt, output, truth) => `Score factual accuracy...${prompt}${output}${truth}`,
    completeness:    (prompt, output, truth) => `Score completeness...${prompt}${output}${truth}`,
    toolEfficiency:  (prompt, output, truth) => `Score tool efficiency...${prompt}${output}${truth}`,
    responseQuality: (prompt, output, truth) => `Score response quality...${prompt}${output}${truth}`,
  },
};
```

### Step 3 — Write test cases

Create `eval/test-cases/my-tool.yaml`:

```yaml
- id: "my-tool-basic-001"
  description: "Basic usage test"
  fixture: "simple/my-fixture.txt"
  prompt: "Analyze {filePath}"
  expectedResults:
    someField: "expected value"
  scoring:
    factualAccuracy:
      weight: 0.35
    completeness:
      weight: 0.30
    toolEfficiency:
      weight: 0.20
      maxToolCalls: 2
    responseQuality:
      weight: 0.15
```

### Step 4 — Add fixture files

Create `eval/fixtures/simple/my-fixture.txt` (or `.cls`, `.json`, whatever your tool processes).

### Step 5 — Create the entry point

Create `eval/run-eval.ts`:

```typescript
#!/usr/bin/env tsx
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import chalk from 'chalk';
import { EvalRunner, ConsoleReporter, JsonReporter } from '@salesforce/mcp-eval-framework';
import type { TestCase } from '@salesforce/mcp-eval-framework';
import { myToolAdapter } from './adapter/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// parse CLI args (--skip-judge, --filter, --model, --judge-model, --mcp-config)
// load YAML test cases
// preflightCheck() — verify claude CLI exists
// print banner
// run

const runner = new EvalRunner(__dirname, myToolAdapter, { skipJudge: true });
const report = await runner.run(testCases);
new ConsoleReporter(myToolAdapter).report(report);
new JsonReporter(path.join(__dirname, 'results')).report(report);
process.exit(report.summary.failedCases > 0 ? 1 : 0);
```

See `packages/mcp-provider-scale-products/eval/run-eval.ts` for a complete example.

### Run it

```bash
npx tsx eval/run-eval.ts --skip-judge
```

---

## 4. EvalAdapter Interface Deep-Dive

### `toolName: string`
The exact tool name the agent should call (e.g. `"scan_apex_class_for_antipatterns"`). Used by `evaluateEndState()` to check tool selection in the agent's output.

### `allowedToolsPattern: string`
The Claude CLI `--allowedTools` glob that auto-approves your MCP tool calls (e.g. `"mcp__salesforce__*,mcp__salesforce-dx__*"`). Without this, the agent prompts for permission on every tool call.

### `resolvePromptPlaceholders(testCase, filePath, directory)`
Returns a `Record<string, string>` of extra `{placeholder}` substitutions for prompt templates.

Built-ins applied by the framework: `{filePath}` and `{directory}`. Any additional keys you return here are also substituted.

```typescript
// Backward compat example: YAMLs use {apexFilePath} → map to filePath
resolvePromptPlaceholders(_testCase, filePath, _directory) {
  return { apexFilePath: filePath };
}
```

### `evaluateEndState(output, rawOutput, expected, config)`
Deterministic scoring: given parsed agent output, return pass/fail + domain details.

- `output.toolCalls` — list of `{ toolName, input }` from the agent run
- `output.responseText` — final text response + tool result content
- `rawOutput` — raw stdout (use as fallback for text-matching)
- `expected` — the `expectedResults` from the YAML (cast to your type internally)
- `config.maxToolCalls` — maximum acceptable tool calls

Return a `DomainEndStateResult`:
```typescript
{
  toolSelected: boolean;        // did agent call the right tool?
  toolCallCount: number;        // how many times was the tool called?
  toolCallCountWithinMax: boolean;
  pass: boolean;                // overall deterministic pass
  details: Record<string, unknown>;  // anything extra for formatEndStateDetails()
}
```

### `formatGroundTruth(expected)`
Converts `expectedResults` to a natural language string for the LLM judge.

```typescript
formatGroundTruth(expected) {
  const exp = expected as unknown as MyExpectedType;
  return `Expected: ${exp.resultCount} results with type "${exp.resultType}"`;
}
```

### `formatEndStateDetails(result)`
Returns string lines to display per test case in the terminal — domain-specific detail beyond tool selection and call count.

```typescript
formatEndStateDetails(result) {
  const lines: string[] = [];
  if (result.details.falsePositivesFound) lines.push('FP: yes');
  for (const item of result.details.detected as string[]) {
    lines.push(`Found: ${item}`);
  }
  return lines;
}
```

### `rubrics.*`
Four functions that each take `(prompt, agentOutput, groundTruth)` and return a scoring prompt string for the judge. The judge is expected to respond with JSON `{ "score": 1-5, "justification": "..." }`.

See `eval/adapter/rubrics/` in `mcp-provider-scale-products` for complete examples.

---

## 5. Writing Test Cases

### YAML Schema

```yaml
- id: "my-tool-scenario-001"         # unique, kebab-case
  description: "One-line human description"
  fixture: "simple/my-file.cls"       # relative to eval/fixtures/
  prompt: "Analyze {filePath}"        # use {filePath} and {directory}
  expectedResults:                    # any shape — your adapter interprets it
    antipatternCount: 1
    noAntipatterns: false
  scoring:
    factualAccuracy:
      weight: 0.35
    completeness:
      weight: 0.30
    toolEfficiency:
      weight: 0.20
      maxToolCalls: 2        # raise for vague prompts needing more exploration
    responseQuality:
      weight: 0.15
```

**Weights must sum to 1.0.**

### Weight guidance

| Use case | Suggested weights |
|----------|------------------|
| Agent must figure out all params itself | toolEfficiency: 0.40 |
| Correctness of detection is critical | factualAccuracy: 0.35 |
| Vague prompt, may need extra lookups | maxToolCalls: 4 |

---

## 6. Writing Realistic Prompts

The agent should be tested as a real developer would use it — not with over-specified instructions.

**Bad (over-specified):**
```yaml
prompt: "Scan the Apex class MyClass at {filePath} for antipatterns. Directory: {directory}."
```

**Good (realistic):**
```yaml
prompt: "Scan {filePath}"
prompt: "Something's slow in production — what's wrong with {filePath}?"
prompt: "Review MyClass before we deploy"
```

Rule: if a developer would feel weird typing the prompt in chat, it's too structured.

---

## 7. Fixtures

- Any file type — your adapter handles interpretation
- Keep fixtures minimal: the smallest file that reliably triggers the target behavior
- Use subdirectories: `simple/`, `medium/`, `complex/`, `edge-cases/`
- Name files after what they test: `single-ggd.cls`, `clean-class.cls`, `no-results.json`

---

## 8. Running the Eval

Add to your `package.json`:
```json
"scripts": {
  "eval": "tsx eval/run-eval.ts",
  "eval:fast": "tsx eval/run-eval.ts --skip-judge"
}
```

| Command | What it does |
|---------|-------------|
| `yarn eval` | Full run with LLM judge (slow, expensive) |
| `yarn eval --skip-judge` | Fast deterministic-only run |
| `yarn eval --model haiku` | Use a specific Claude model as the agent |
| `yarn eval --judge-model opus` | Use a specific model as the LLM judge |
| `yarn eval --filter "my-tool"` | Run only test cases matching the pattern |
| `yarn eval --mcp-config path/to/config.json` | Override MCP config file |

---

## 9. Interpreting Results

| Score | Meaning |
|-------|---------|
| 5.0 | Perfect: correct tool, correct output, clean response |
| 3.5–4.9 | Passing (above default threshold) |
| 1.0–3.4 | Failing — check tool selection, parameter correctness, output completeness |

**Key signals to look for:**
- `Tool: ✘` — agent never invoked your tool (prompt may be too vague, or tool description needs improvement)
- `Calls: 5 (over max)` — agent needed too many tool calls (simplify the prompt or improve tool's input guidance)
- `FP: yes` — agent reported something that shouldn't be there (false positive in detection logic)

---

## 10. End-to-End Example

Here's a complete adapter for a hypothetical `run_code_analysis` tool:

### `eval/adapter/index.ts`

```typescript
import type {
  EvalAdapter,
  TestCase,
  ParsedAgentOutput,
  ToolEfficiencyConfig,
  DomainEndStateResult,
} from '@salesforce/mcp-eval-framework';

interface ExpectedResults {
  issueCount: number;
  issueTypes: string[];
  clean: boolean;
}

export const codeAnalysisAdapter: EvalAdapter = {
  toolName: 'run_code_analysis',
  allowedToolsPattern: 'mcp__my-analyzer__*',

  resolvePromptPlaceholders(_testCase: TestCase, filePath: string, _directory: string) {
    return { filePath };  // {filePath} is already built-in, this is a no-op example
  },

  evaluateEndState(
    output: ParsedAgentOutput,
    rawOutput: string,
    expected: Record<string, unknown>,
    config: ToolEfficiencyConfig
  ): DomainEndStateResult {
    const exp = expected as unknown as ExpectedResults;
    const toolSelected = output.toolCalls.some(tc => tc.toolName.includes('run_code_analysis'));
    const toolCallCount = output.toolCalls.filter(tc => tc.toolName.includes('run_code_analysis')).length;
    const maxCalls = config.maxToolCalls ?? 2;

    const combinedText = output.responseText + '\n' + rawOutput;
    const foundIssueTypes = exp.issueTypes.filter(t => combinedText.includes(t));
    const allIssuesFound = foundIssueTypes.length === exp.issueTypes.length;

    return {
      toolSelected,
      toolCallCount,
      toolCallCountWithinMax: toolCallCount <= maxCalls,
      pass: toolSelected && toolCallCount <= maxCalls && (exp.clean || allIssuesFound),
      details: { foundIssueTypes, expectedIssueTypes: exp.issueTypes, clean: exp.clean },
    };
  },

  formatGroundTruth(expected: Record<string, unknown>): string {
    const exp = expected as unknown as ExpectedResults;
    if (exp.clean) return 'The file is CLEAN — no issues should be reported.';
    return `Expected ${exp.issueCount} issues of types: ${exp.issueTypes.join(', ')}`;
  },

  formatEndStateDetails(result: DomainEndStateResult): string[] {
    const d = result.details as { foundIssueTypes: string[]; expectedIssueTypes: string[] };
    return [
      `Found types: ${d.foundIssueTypes.join(', ') || 'none'}`,
      `Expected:    ${d.expectedIssueTypes.join(', ') || 'none'}`,
    ];
  },

  rubrics: {
    factualAccuracy: (prompt, output, truth) => `Score factual accuracy 1-5.\nPrompt: ${prompt}\nOutput: ${output}\nTruth: ${truth}\nOutput JSON: {"score": N, "justification": "..."}`,
    completeness:    (prompt, output, truth) => `Score completeness 1-5.\nPrompt: ${prompt}\nOutput: ${output}\nTruth: ${truth}\nOutput JSON: {"score": N, "justification": "..."}`,
    toolEfficiency:  (prompt, output, truth) => `Score tool efficiency 1-5.\nPrompt: ${prompt}\nOutput: ${output}\nTruth: ${truth}\nOutput JSON: {"score": N, "justification": "..."}`,
    responseQuality: (prompt, output, truth) => `Score response quality 1-5.\nPrompt: ${prompt}\nOutput: ${output}\nTruth: ${truth}\nOutput JSON: {"score": N, "justification": "..."}`,
  },
};
```

### `eval/test-cases/code-analysis.yaml`

```yaml
- id: "analysis-basic-001"
  description: "Basic analysis — single issue detected"
  fixture: "simple/single-issue.ts"
  prompt: "Analyze {filePath}"
  expectedResults:
    issueCount: 1
    issueTypes: ["unused-variable"]
    clean: false
  scoring:
    factualAccuracy:
      weight: 0.35
    completeness:
      weight: 0.30
    toolEfficiency:
      weight: 0.20
      maxToolCalls: 2
    responseQuality:
      weight: 0.15

- id: "analysis-clean-001"
  description: "Clean file — no issues"
  fixture: "simple/clean-file.ts"
  prompt: "Is there anything wrong with {filePath}?"
  expectedResults:
    issueCount: 0
    issueTypes: []
    clean: true
  scoring:
    factualAccuracy:
      weight: 0.30
    completeness:
      weight: 0.25
    toolEfficiency:
      weight: 0.30
      maxToolCalls: 3
    responseQuality:
      weight: 0.15
```
