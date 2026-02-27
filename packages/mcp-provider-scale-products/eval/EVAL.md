# MCP Agent Evaluation Framework

An end-to-end evaluation framework that tests how well an AI agent uses MCP tools. It invokes Claude Code CLI as the MCP client, sends natural language prompts, and scores the agent's tool selection, parameter extraction, and result interpretation using both deterministic checks and LLM-as-judge rubrics.

This framework was built for `mcp-provider-scale-products` (the `scan_apex_class_for_antipatterns` tool) but is designed to be adapted for any MCP tool.

## Quick Start

### Prerequisites

1. **Claude Code CLI** installed and authenticated:
   ```bash
   claude --version
   ```

2. **Salesforce MCP server** configured in your Claude Code settings and verified:
   ```bash
   claude mcp list
   # Should show salesforce or salesforce-dx as "connected"
   ```

3. **Dev dependencies** installed:
   ```bash
   yarn install
   ```

### Running Evals

```bash
# Full eval: agent invocation + LLM-as-judge scoring
yarn eval

# Fast mode: agent invocation + deterministic scoring only (skips judge API calls)
yarn eval:fast

# Filter by test case ID or description
yarn eval:filter simple

# Specify agent model
yarn eval -- --model opus

# Test with haiku, evaluate with opus
yarn eval -- --model haiku --judge-model opus

# Combine flags
yarn eval -- --model sonnet --skip-judge --filter complex
```

### CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--skip-judge` | Skip LLM-as-judge, use deterministic scoring only | `false` |
| `--filter <pattern>` | Filter test cases by ID or description substring | all cases |
| `--model <model>` | Model for the agent under test (`sonnet`, `opus`, `haiku`) | `sonnet` |
| `--judge-model <model>` | Model for the LLM-as-judge evaluator (`sonnet`, `opus`, `haiku`, or full model ID) | `sonnet` |
| `--mcp-config <path>` | Explicit MCP server config file (overrides user settings) | user's Claude Code config |

## Architecture

```
eval/
├── run-eval.ts                    # Entry point (CLI arg parsing, preflight check)
├── mcp-config.json                # Template MCP config (opt-in, not auto-detected)
│
├── fixtures/                      # Apex test files with known antipatterns
│   ├── simple/                    # Single antipattern or clean class
│   ├── medium/                    # Multiple instances or mixed types
│   ├── complex/                   # All antipattern types combined
│   └── edge-cases/                # Comments-only, empty class, etc.
│
├── test-cases/                    # YAML test case definitions
│   ├── simple-detection.yaml
│   ├── medium-detection.yaml
│   ├── complex-detection.yaml
│   └── edge-cases.yaml
│
├── runner/                        # Evaluation orchestration
│   ├── eval-runner.ts             # Main runner (per-case lifecycle)
│   ├── claude-cli-invoker.ts      # Wraps `claude -p` invocation
│   └── fixture-manager.ts         # Temp directory and file management
│
├── scoring/                       # Scoring engines
│   ├── types.ts                   # All TypeScript interfaces
│   ├── end-state.ts               # Deterministic checks (no extra API calls)
│   └── judge.ts                   # LLM-as-judge via Claude CLI
│
├── rubrics/                       # LLM-as-judge scoring rubrics
│   ├── factual-accuracy.ts
│   ├── completeness.ts
│   ├── tool-efficiency.ts
│   └── response-quality.ts
│
├── reporting/                     # Result output
│   ├── console-reporter.ts        # Color-coded terminal output
│   └── json-reporter.ts           # Timestamped JSON reports
│
└── results/                       # Output directory (gitignored)
    └── eval-{timestamp}.json
```

### Data Flow

```
Prompt template         Fixture file
     │                      │
     ▼                      ▼
┌──────────────────────────────────┐
│          EvalRunner              │
│  1. Copy fixture to temp dir     │
│  2. Substitute {apexFilePath}    │
│     and {directory} in prompt    │
│  3. Invoke Claude CLI            │
│  4. Score results                │
│  5. Produce report               │
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│      ClaudeCliInvoker            │
│  claude -p <prompt>              │
│    --output-format stream-json   │
│    --verbose                     │
│    --model <model>               │
│    --dangerously-skip-permissions│
│    --allowedTools mcp__*         │
│                                  │
│  stdin: /dev/null (ignored)      │
│  stdout: stream-json events      │
└──────────┬───────────────────────┘
           │
     ┌─────┴──────┐
     ▼            ▼
┌──────────┐ ┌──────────┐
│ EndState │ │  Judge   │
│Evaluator │ │Evaluator │
│(no extra │ │(+4 CLI   │
│ CLI cost)│ │ calls)   │
└────┬─────┘ └────┬─────┘
     │            │
     ▼            ▼
┌──────────────────────────────────┐
│      EvalReport (JSON)           │
│  Per-case scores + summary       │
└──────────────────────────────────┘
```

## Scoring

### Two Scoring Layers

**1. End-State Evaluator (deterministic, no extra API calls)**

Parses the stream-json output and checks:

| Check | What it verifies |
|-------|-----------------|
| Tool selected | Was `scan_apex_class_for_antipatterns` invoked? |
| Tool call count | Within the expected max (default: 2)? |
| Antipattern detection | Each expected type found in the output? |
| Count correctness | At least the expected number of instances detected? |
| Severity correctness | Correct severity string (`critical`, `major`, `minor`) present? |
| False positive check | Unexpected antipattern types absent from structured output? |
| Clean class handling | If no antipatterns expected, was "no issues" reported? |

In `--skip-judge` mode, a case passes if ALL deterministic checks pass (score = 5.0), otherwise fails (score = 1.0).

**2. LLM-as-Judge (4 rubric dimensions)**

Uses Claude Code CLI (`claude -p`) to score across four dimensions on a 1-5 Likert scale. Each rubric is a separate `claude -p` invocation in plain text mode (no tools, no MCP):

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Factual Accuracy | 0.35 | Antipattern types, severities, line numbers match ground truth |
| Completeness | 0.30 | All antipatterns found, no false positives, no omissions |
| Tool Efficiency | 0.20 | Correct tool selected, minimal calls, correct parameters |
| Response Quality | 0.15 | Clear, actionable presentation; organized; easy to scan |

Each rubric prompts the judge with the original prompt, agent output, and ground truth, then requires chain-of-thought justification before the score.

**Composite score** = weighted sum of all four dimensions. Pass threshold: **3.5/5.0**.

### Why Two Layers?

- **End-state** adds no extra API cost beyond the agent invocation — use `--skip-judge` during development for rapid iteration
- **Judge** adds nuance (partial credit, response quality) but costs 4 additional Claude CLI calls per case
- When judge is enabled, the composite score is used; otherwise, binary pass/fail from end-state

## Test Case Format

Test cases are defined in YAML files under `eval/test-cases/`. Each file contains an array of cases.

```yaml
- id: "simple-ggd-001"                    # Unique identifier
  description: "Single GGD call"           # Human-readable description
  fixture: "simple/single-ggd.cls"         # Path relative to eval/fixtures/
  className: "SingleGGDClass"              # Apex class name (for tool param)
  prompt: >-                               # Prompt template with placeholders
    Scan the Apex class SingleGGDClass
    at {apexFilePath} for antipatterns.
    Directory: {directory}.
  expectedResults:
    antipatternCount: 1                    # Total instances expected
    antipatterns:
      - type: "GGD"                        # Antipattern type string
        count: 1                           # Expected instance count
        severity: "critical"               # Expected severity
    falsePositiveTypes: []                 # Types that should NOT appear
    noAntipatterns: false                  # True for clean classes
  scoring:
    factualAccuracy:
      weight: 0.35                         # Dimension weight (sum to 1.0)
    completeness:
      weight: 0.30
    toolEfficiency:
      weight: 0.20
      expectedToolName: "scan_apex_class_for_antipatterns"
      maxToolCalls: 2                      # Max acceptable tool invocations
    responseQuality:
      weight: 0.15
```

### Placeholders

The runner substitutes these placeholders in the prompt at runtime:

| Placeholder | Replaced with |
|-------------|--------------|
| `{apexFilePath}` | Absolute path to the fixture file (in temp dir) |
| `{directory}` | Absolute path to the temp working directory |

### Prompt Styles

Test cases include different prompt styles to evaluate tool selection robustness:

- **Direct**: `"Scan the Apex class X at {apexFilePath} for antipatterns."`
- **Vague**: `"Can you check this code for performance issues?"`
- **Natural**: `"I want to make sure my class follows best practices."`

## Fixtures

Fixtures are Apex class files in `eval/fixtures/` with known antipattern ground truth.

### Current Fixtures

| Fixture | Antipatterns | Severity |
|---------|-------------|----------|
| `simple/single-ggd.cls` | 1 GGD | critical |
| `simple/single-soql-no-where.cls` | 1 SOQL_NO_WHERE_LIMIT | major |
| `simple/clean-class.cls` | None (clean) | - |
| `medium/soql-unused-fields.cls` | 1 SOQL_UNUSED_FIELDS | minor |
| `medium/mixed-two-types.cls` | 1 GGD + 1 SOQL_NO_WHERE_LIMIT | critical + major |
| `complex/all-three-antipatterns.cls` | 1 GGD + 1 SOQL_NO_WHERE + 1 SOQL_UNUSED | critical + major + minor |
| `edge-cases/comments-only.cls` | None (antipatterns in comments only) | - |

### Adding New Fixtures

1. Create an `.cls` file in the appropriate tier directory under `eval/fixtures/`
2. Include known antipatterns (or none for clean classes)
3. Reference it from a test case YAML file

## Reports

### Console Output

The console reporter prints color-coded results:

```
PASS  simple-ggd-001 (5.00/5.0)
       Single GGD call in a method
       Tool selected: yes  |  Tool calls: 1  |  False positives: none
       GGD: found  count: 3/1  severity: ok

FAIL  some-case-002 (2.50/5.0)
       Tool selected: no  |  Tool calls: 0  |  False positives: none
       GGD: missed  count: 0/1  severity: mismatch
```

### JSON Reports

Full reports are written to `eval/results/eval-{timestamp}.json` containing:

- Run configuration (model, judge enabled, threshold, filter)
- Per-case results (prompt, CLI output, end-state scores, judge scores)
- Summary statistics (pass rate, averages, worst cases)

## MCP Server Configuration

The eval framework does **not** auto-detect the `eval/mcp-config.json` file. By default, it uses whatever MCP servers you have configured in your Claude Code settings.

### Option A: Use Your Claude Code Config (Recommended)

Configure and verify your MCP server in Claude Code settings:

```bash
# Verify your server is connected
claude mcp list
# Should show salesforce or salesforce-dx as "connected"
```

Then run evals normally — the agent will use your configured MCP servers.

### Option B: Explicit MCP Config

Pass `--mcp-config` to use a specific configuration:

```bash
yarn eval -- --mcp-config eval/mcp-config.json
```

Edit `eval/mcp-config.json` to point to your server:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "node",
      "args": [
        "/path/to/mcp/packages/mcp/bin/run.js",
        "--toolsets",
        "scale-products"
      ]
    }
  }
}
```

### MCP Server Name and Tool Naming

The agent auto-discovers MCP tools by their server-qualified names:

| Server name in config | Tool name pattern |
|----------------------|-------------------|
| `salesforce` | `mcp__salesforce__scan_apex_class_for_antipatterns` |
| `salesforce-dx` | `mcp__salesforce-dx__scan_apex_class_for_antipatterns` |

The eval framework handles both patterns — the end-state evaluator matches any tool name containing `scan_apex_class_for_antipatterns`.

## Implementation Details

### Claude CLI Invocation

The `ClaudeCliInvoker` uses `spawn` (not `execFile`) with specific flags:

```typescript
spawn("claude", [
  "-p", prompt,                              // Print mode (non-interactive)
  "--output-format", "stream-json",          // Structured output with tool metadata
  "--verbose",                               // Required for stream-json in print mode
  "--model", model,                          // Agent model (sonnet, opus, haiku)
  "--dangerously-skip-permissions",          // Auto-approve built-in tools
  "--allowedTools", "mcp__salesforce__*,...", // Auto-approve MCP tools
], {
  stdio: ["ignore", "pipe", "pipe"],         // stdin=/dev/null (prevents TTY hang)
  env: { ...process.env, CLAUDECODE: "" },   // Allow nested CLI invocation
});
```

Key behaviors:

- **`stdio: ["ignore", ...]`**: Claude CLI hangs without a TTY if stdin is piped. Setting stdin to `"ignore"` (/dev/null) prevents this.
- **`CLAUDECODE: ""`**: Unsets the env var that prevents nested Claude Code invocations.
- **`--dangerously-skip-permissions`**: Auto-approves built-in tools (Read, Write, Bash, etc.).
- **`--allowedTools`**: Auto-approves MCP tools. Without this, MCP tools get permission-denied even with `--dangerously-skip-permissions`.
- **Timeout**: 180 seconds per case (configurable via `CliInvokerConfig.timeoutMs`).

### Stream-JSON Parsing

The `EndStateEvaluator.parseOutput()` method parses the stream-json output format:

| Event type | What's extracted |
|-----------|-----------------|
| `{"type": "system", "subtype": "init"}` | Tool list, MCP server status |
| `{"type": "assistant", "message": {"content": [{"type": "tool_use", ...}]}}` | Tool calls (name + input) |
| `{"type": "assistant", "message": {"content": [{"type": "text", ...}]}}` | Agent text responses |
| `{"type": "user", "tool_use_result": "..."}` | MCP tool output content |
| `{"type": "result"}` | Final response text |

### Fixture Isolation

The `FixtureManager` copies each fixture to a fresh temp directory (`/tmp/mcp-eval-XXXXXX/`) before each test case. This ensures:

- Absolute paths are used (no path resolution issues)
- Tests don't interfere with each other
- Temp files are cleaned up after each case

---

## Adapting for Other MCP Tools

This framework can be reused to evaluate any MCP tool, not just `scan_apex_class_for_antipatterns`. Here's how to adapt it for your tool.

### Step 1: Create Fixtures

Create input files that your tool operates on. Place them in `eval/fixtures/` organized by complexity:

```
eval/fixtures/
├── simple/
│   ├── basic-input.json
│   └── clean-input.json
├── complex/
│   └── multi-issue-input.json
└── edge-cases/
    └── empty-input.json
```

### Step 2: Define Test Cases

Create YAML files in `eval/test-cases/` with your tool's ground truth. Adapt the `expectedResults` schema for your tool's output domain:

```yaml
- id: "my-tool-basic-001"
  description: "Basic input with one issue"
  fixture: "simple/basic-input.json"
  className: "not-used-but-required"     # Adapt or remove for your schema
  prompt: >-
    Analyze the file at {apexFilePath} using my_tool.
    Working directory: {directory}.
  expectedResults:
    antipatternCount: 1                   # Adapt these fields
    antipatterns:
      - type: "MY_ISSUE_TYPE"
        count: 1
        severity: "high"
    falsePositiveTypes: []
    noAntipatterns: false
  scoring:
    factualAccuracy: { weight: 0.35 }
    completeness: { weight: 0.30 }
    toolEfficiency:
      weight: 0.20
      expectedToolName: "my_tool_name"    # Your tool's name
      maxToolCalls: 2
    responseQuality: { weight: 0.15 }
```

### Step 3: Update the End-State Evaluator

Modify `eval/scoring/end-state.ts` to match your tool's output patterns:

1. **`SCAN_TOOL_NAME`** constant: Change to your tool's name substring
2. **`isAntipatternTypePresent()`**: Update the friendly name mappings for your issue types
3. **`countAntipatternInstances()`**: Update the JSON field names to match your tool's output structure
4. **`checkCleanClass()`**: Update the clean-result indicator strings

### Step 4: Update the CLI Invoker

Modify `eval/runner/claude-cli-invoker.ts`:

1. **`--allowedTools`**: Update the glob pattern to match your MCP server name:
   ```typescript
   "--allowedTools", "mcp__my-server__*",
   ```

### Step 5: Update Rubrics (Optional)

If your tool operates in a different domain than Apex antipatterns, update the rubric prompts in `eval/rubrics/` to use domain-appropriate language and scoring criteria.

### Step 6: Update Types (If Needed)

If your tool's output structure differs significantly from the antipattern scanner, extend the types in `eval/scoring/types.ts`:

```typescript
export interface ExpectedResults {
  // Rename or add fields for your domain
  issueCount: number;
  issues: ExpectedIssue[];
  falsePositiveTypes: string[];
  noIssues: boolean;
}
```

### Key Design Principles

1. **User configures their own MCP server**: Don't bundle a local server config. Users should set up their MCP server in Claude Code settings and verify with `claude mcp list` before running evals.

2. **Don't restrict the agent's tools**: Let the agent use its full toolkit. If it bypasses your MCP tool and does manual analysis, that's a meaningful signal scored by the tool-efficiency rubric.

3. **Use `--skip-judge` during development**: The deterministic layer adds no extra API cost beyond the agent invocation itself. Only enable the LLM judge for final scoring runs.

4. **Test prompt diversity**: Include direct prompts, vague prompts, and natural language prompts to evaluate tool selection robustness.

5. **Include negative cases**: Add clean/no-issue fixtures to test false positive handling.

## Troubleshooting

### Claude CLI hangs with empty output

The invoker must use `stdio: ["ignore", "pipe", "pipe"]` with `spawn`. Without `/dev/null` on stdin, Claude CLI hangs waiting for TTY input.

### MCP tools get "permission denied"

Add `--allowedTools` with a glob matching your MCP server's tool names. `--dangerously-skip-permissions` only covers built-in tools, not MCP tools.

### "Claude Code cannot be launched inside another Claude Code session"

Set `CLAUDECODE: ""` in the child process environment to bypass the nesting check.

### "--output-format stream-json requires --verbose"

Always include `--verbose` when using `--output-format stream-json` in print mode.

### Agent falls back to manual file reading instead of using the tool

Check `claude mcp list` to verify your MCP server is connected. Also verify `--allowedTools` includes the correct glob pattern for your server name.

### Tests time out at 180 seconds

The default timeout is 180s per case. Complex cases with large prompts may need more time. Increase `DEFAULT_TIMEOUT_MS` in `claude-cli-invoker.ts` or set `timeoutMs` in `CliInvokerConfig`.

## Cost

| Mode | Cost per case | Notes |
|------|--------------|-------|
| `--skip-judge` | Agent CLI call only (~$0.10-0.30 for sonnet) | Deterministic scoring adds no extra CLI calls |
| Full (with judge) | Agent + 4 judge CLI calls (~$0.15-0.50 extra for sonnet judge) | Judge uses `claude -p` in plain text mode |

Every eval case invokes the Claude CLI agent (LLM cost), which processes the prompt and calls the MCP tool. The `--skip-judge` flag only skips the 4 additional `claude -p` judge calls per case used for rubric scoring. Use `--judge-model` to control which model evaluates the rubrics.

A full 10-case run with judge enabled costs approximately $2-5 depending on model and response length.
