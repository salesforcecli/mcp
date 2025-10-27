# Testing MCP tools

This doc covers the different types of tests used to validate MCP tools and ensure they work correctly with LLM agents.

## Types of tests

### E2E Tool Tests

E2E tool tests focus on the tool logic (no LLM inference required) by using an MCP client to call the tool. Write test cases to assert that:
* invalid param combinations/values return a tool error ([`isError: true` set in the response](https://modelcontextprotocol.io/specification/2025-06-18/server/tools#error-handling))
* valid user flows run successfully
* [a specific toolset enables your tools](https://github.com/salesforcecli/mcp/blob/15c13cc8f56cf0360c95989c839bcedd5e67a817/packages/mcp-provider-code-analyzer/test/e2e/run_code_analyzer-e2e.test.ts#L23)

These tests will run on each PR in this repo in linux and windows.

#### Setup

Use the `@salesforce/mcp-test-client` MCP client to start the server and client:

```typescript
import { McpTestClient, DxMcpTransport } from '@salesforce/mcp-test-client';
import { z } from 'zod';

const client = new McpTestClient({ timeout: 300_000 });

// Define tool schema
// NOTE: to avoid duplication you may want to import this from your tool
const toolSchema = {
  name: z.literal('run_soql_query'),
  params: z.object({
    query: z.string(),
    usernameOrAlias: z.string(),
    directory: z.string()
  })
};

// Connect with DX transport
const transport = DxMcpTransport();
await client.connect(transport);

// Call tool directly
const result = await client.callTool(toolSchema, {
  name: 'run_soql_query',
  params: {
    query: 'SELECT Name FROM Account LIMIT 8',
    usernameOrAlias: 'test-org',
    directory: '/path/to/project'
  }
});

expect(result.isError).to.equal(false);
expect(result.content.length).to.equal(1);
if (result.content[0].type !== 'text') assert.fail();

const responseText = result.content[0].text;
expect(responseText).to.contain('SOQL query results:');

// Parse the query result JSON
const queryMatch = responseText.match(/SOQL query results:\s*({[\s\S]*})/);
expect(queryMatch).to.not.be.null;

const queryResult = JSON.parse(queryMatch![1]) as QueryResult<jsforceRecord & { Name: string }>;
expect(queryResult.totalSize).to.equal(8);
expect(queryResult.done).to.be.true;
expect(queryResult.records).to.be.an('array');
expect(queryResult.records.length).to.equal(8);
```

See [packages/mcp-provider-dx-core/test/e2e/run_soql_query.test.ts](./packages/mcp-provider-dx-core/test/e2e/run_soql_query.test.ts) for a complete example.

> [!IMPORTANT]
> These tests should be located in each tool provider package, not in the main MCP package.
> 
> `@salesforce/mcp-test-client` is a package inside this monorepo and isn't published. You should add it as a devDep matching its current version to get it in your local provider pkg:
>
> https://github.com/salesforcecli/mcp/tree/main/packages/mcp-test-client

You can use any test runner you want, we recommend Vitest or Mocha.

### Evals

Evaluation tests use LLMs to evaluate tests results. We use two types of tests powered by [vitest-evals](https://github.com/getsentry/vitest-evals/).

#### Discoverability

These tests allow you to validate that certain prompts will call your tool with the right parameters.
Each prompt (`input`) should be accompanied by an expected list of tool calls with its params (`expectedTools`), then the `ToolPredictionScorer` scorer will:
* Load all DX MCP tools into context (even non-GA) with the test data (input & expected tool calls)
* Score the expected tool calls based on the MCP tools metadata.

Unlike other E2E tests, these don't do any tool call and so they are cheaper to run (each test case does 1 roundtrip, check all DX MCP tool metadata for token qty).

Example:

```typescript
import { describeEval } from 'vitest-evals';
import { NoOpTaskRunner } from '../utils/runners.js';
import { ToolPredictionScorer } from '../utils/scorers/toolPredictionScorer.js';

describeEval('run_soql_query', {
  data: async () => [
    {
      input: 'List the name of the Property__c records in my org, ordered in ascending order by their name.',
      expectedTools: [
        {
          name: 'run_soql_query',
          arguments: {
            query: 'SELECT Name FROM Property__c ORDER BY Name ASC',
            usernameOrAlias: 'ebikes',
            directory: process.env.SF_EVAL_PROMPT_PROJECT_DIR,
          },
        },
      ],
    },
  ],
  task: NoOpTaskRunner(),
  scorers: [ToolPredictionScorer()],
  threshold: 1.0,
  timeout: 30_000,
});
```

See [packages/mcp/test/evals/discoverability/run_soql_query.eval.ts](./packages/mcp/test/evals/discoverability/run_soql_query.eval.ts) for a complete example.


#### E2E Evals

These test intend to cover a real scenario by running each test case in an agent loop with all DX MCP tools exposed. The agent will stop once the task is finished (or if it can't continue).

Use the Factuality scorer to evaluate the agent response (`response should include X records`, `it should list all tests executed`, etc).
You can also use the vitest-eval's `ToolCallScorer` scorer to evaluate that tools were called correctly.

```typescript
import { describeEval, ToolCallScorer } from 'vitest-evals';
import { TaskRunner } from '../utils/runners.js';
import { Factuality } from '../utils/scorers/factuality.js';

describeEval('SOQL queries', {
  data: async () => [
    {
      input: 'List the name of the Property__c records in my org, ordered in ascending order by their name.',
      expected: 'The response should include these records: Architectural Details, City Living...',
      expectedTools: [
        {
          name: 'run_soql_query',
          arguments: {
            query: 'SELECT Name FROM Property__c ORDER BY Name ASC',
            usernameOrAlias: orgUsername,
            directory: projectDir,
          },
        },
      ],
    },
  ],
  task: (input: string) =>
    TaskRunner({
      promptOptions: {
        currentOpenFile: '',
        currentOpenWorkspace: projectDir,
      },
    })(input),
  scorers: [
    Factuality(),
    ToolCallScorer({
      ordered: true,
      params: 'fuzzy',
    }),
  ],
  threshold: 0.8,
  timeout: 300_000,
});
```

> [!TIP]
> If you need to set an SFDX project with a scratch org, use the `cli-plugins-testki` library:
>
> https://github.com/salesforcecli/cli-plugins-testkit


See [packages/mcp/test/evals/e2e/run_soql_query.eval.ts](./packages/mcp/test/evals/e2e/run_soql_query.eval.ts) for a complete example.

#### Setting Prompt Options

Configure the task runner with prompt settings:

```typescript
task: (input: string) =>
  TaskRunner({
    promptOptions: {
      // this will set the file/workspace as if being open like in an IDE chat context
      currentOpenFile: apexClassFilePath,
      currentOpenWorkspace: projectDir,
    },
  })(input),
```

#### Scoring

Both eval types use scoring mechanisms:

- **ToolPredictionScorer**: Validates tool selection and parameters
- **Factuality**: Evaluates response accuracy
- **ToolCallScorer**: Checks tool execution with options like:
  - `ordered: true` - Tools must be called in expected order
  - `params: 'fuzzy'` - Allow parameter variations (useful for queries)

Set thresholds (0.0-1.0) to define passing scores. For discoverability tests, use `threshold: 1.0` for exact matches. For E2E tests, use lower thresholds like `threshold: 0.8` to account for response variations.

### What tests should I write for my tools?

This will vary depending on the complexity of your tool, the recommended guidance is:

1. E2E tool tests
Use them to cover the tool logic extensively, focus on:
* Cross OS compatibility (linux and windows)
* Blocking invalid combination of parameters
* [Validating the tool response properly sets `isError` on errors](https://modelcontextprotocol.io/specification/2025-06-18/schema#calltoolresult)

Even if your tools is mostly "instructions-only" (returns instructions for LLM agents), it's good to have coverage since these tests do a real tool call so you ensure the tool is always callable.

2. Discoverability Eval tests
All tools should at least 1 test covering the most common utterances you expect users to type that will call your tool.
These tests run evaluate all tools in the server so by having coverage you cover your tools from being "shadowed" if a new tool with similar description is added.

3. E2E Evals
These should only cover the most common user flows (more expensive to run), tips:
* The user utterance should cover a user flow calling at least 2 tool calls
* Use the `Factuality` scorer to validate the final agent response (`input: run the Geocoding apex test` -> `output: successfully ran the 3 Geocoding apex tests ...`)
* Use the `ToolCallScorer` scorer to assert the chain of tools (and its param) were called in the correct order

Unsure if your tool should have an E2E eval test?
* If it's an "instructions-only" tool, discoverabitly eval tests may be enough since you care mostly on the tool being called (after that the agent might call built-in tools/other CLI commands)
* Is your tool response critical when combined with other tool in a user task? if not, then discoverability + E2E tool tests might be enough.

Good scenarios for E2E eval tests:

* `run_soql_query` tool returns raw SOQL results and we want to evaluate agent response contains the expected records.
* `get_username` is used to resolve org usernames, the `deploy_metadata` validates a user utterance like:
```
Deploy this file and run the GeocodingServiceTest tests, then summarize the apex test results.
```
calls `get_username` -> `deploy_metadata`

Bad scenarios:

* "instructions-only" tools
* CRUD tools where their responses aren't required for an agent task (e.g. `create_scratch_org` output doesn't matter as long as its successful, that can be covered in a simple E2E tool test)

### FAQ 

* Which LLMs models are we testing against?

Only `gemini-2.5-flash` using the Gemini API.
We plan support more models once we switch to Salesforce's LLMG.
