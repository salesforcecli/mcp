/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { printTable } from '@oclif/table';
import { stdout, colorize } from '@oclif/core/ux';
import { Command, Flags } from '@oclif/core';
import { z } from 'zod';
import { makeGatewayRequests } from '../utils/gateway.js';
import { getToolsList, InvocableTool } from '../utils/tools.js';
import { TABLE_STYLE } from '../utils/table.js';
import { readYamlFile } from '../utils/yaml.js';
import { Model } from '../utils/models.js';
import { mintJWT } from '../utils/jwt.js';

const Spec = z.object({
  models: z.array(z.custom<Model>()),
  'initial-context': z.array(z.string()).optional(),
  tests: z.array(
    z.object({
      utterances: z.union([z.string(), z.array(z.string())]),
      'expected-tool': z.string(),
      'expected-parameters': z.record(z.string(), z.string()).optional(),
      'expected-tool-confidence': z.number(),
      'expected-parameter-confidence': z.number().optional(),
      'allowed-tools': z.array(z.string()).optional(),
      skip: z.boolean().optional(),
      only: z.boolean().optional(),
    })
  ),
});

type Spec = z.infer<typeof Spec>;

type TestCase = {
  readable: string;
  utterances: string[];
  expectedTool: string;
  expectedParameters?: Record<string, string>;
  expectedToolConfidence: number;
  expectedParameterConfidence: number;
  allowedTools: string[];
};

const castToArray = <T>(value: T | T[]): T[] => (Array.isArray(value) ? value : [value]);

const groupBy = <T, K extends string | number | symbol>(array: T[], key: (item: T) => K): Record<K, T[]> =>
  array.reduce<Record<K, T[]>>((result, item) => {
    const groupKey = key(item);
    if (!result[groupKey]) {
      return { ...result, [groupKey]: [item] };
    }
    return { ...result, [groupKey]: [...result[groupKey], item] };
    // eslint-disable-next-line
  }, {} as Record<K, T[]>);

const makeReadableParameters = (param: Record<string, string>): string =>
  Object.entries(param)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `  - ${key}: ${value}`)
    .join('\n');

const countRunsThatPassParameterMatching = (
  testSpec: TestCase,
  runs: Array<{ model: string; invocations: Array<{ tool: string; parameters: Record<string, string> }> }>
): number =>
  runs.filter((run) =>
    Object.entries(testSpec.expectedParameters ?? {}).every(([key, value]) =>
      run.invocations.some(
        (inv) =>
          inv.tool === testSpec.expectedTool && inv.parameters[key] && new RegExp(value).test(inv.parameters[key])
      )
    )
  ).length;

const countRunsThatPassToolMatching = (
  testSpec: TestCase,
  runs: Array<{ model: string; invocations: Array<{ tool: string; parameters: Record<string, string> }> }>
): number =>
  runs.filter(
    ({ invocations }) =>
      invocations.some((inv) => inv.tool === testSpec.expectedTool) &&
      invocations.every((inv) => testSpec.allowedTools.includes(inv.tool))
  ).length;

const filterFailingTests = (
  passFailMap: Map<string, { tools: boolean; parameters: boolean }>,
  testIndex: Map<string, TestCase>,
  type: 'tools' | 'parameters'
): TestCase[] =>
  Array.from(passFailMap.entries())
    .filter(([, result]) => !result[type])
    .map(([key]) => testIndex.get(key))
    .filter((test) => test !== undefined);

async function compareModelOutputs(
  jwtToken: string,
  utterances: string | string[],
  spec: Spec,
  tools: InvocableTool[]
): Promise<{
  tableData: Array<{ model: Model; chat: string; tools: string }>;
  invocations: Record<string, Array<{ tool: string; parameters: Record<string, string> }>>;
}> {
  const models = spec.models;
  const responses = await Promise.all(
    models.map((model) => makeGatewayRequests(jwtToken, castToArray(utterances), model, tools, spec['initial-context']))
  );

  const invocations = responses.reduce<Record<string, Array<{ tool: string; parameters: Record<string, string> }>>>(
    (acc, response) => {
      const toolInvocations = response.responses.flatMap((r) => {
        const toolInvocation = r.generation_details?.generations[0].tool_invocations?.[0];
        if (!toolInvocation) return [];

        const parameters: Record<string, string> = toolInvocation.function.arguments
          ? (JSON.parse(toolInvocation.function.arguments) as Record<string, string>)
          : {};

        return [
          {
            tool: toolInvocation.function.name,
            parameters,
          },
        ];
      });
      return { ...acc, [response.model]: toolInvocations };
    },
    {}
  );

  const tableData = responses.map((response) => ({
    model: response.model,
    chat: response.messages.map((m) => `${colorize('bold', m.role)}: ${m.content}`).join('\n\n'),
    tools: response.responses
      .map((r, index) => {
        const toolInvocation = r.generation_details?.generations[0].tool_invocations?.[0];
        if (!toolInvocation) {
          return `Generation ${index + 1}: No tool invoked`;
        }

        const toolArgs = JSON.parse(toolInvocation.function.arguments ?? '{}') as Record<string, string>;
        const argsString = makeReadableParameters(toolArgs);

        return `Generation ${index + 1}: ${colorize('bold', toolInvocation.function.name)}${
          argsString ? `\n${argsString}` : ''
        }`;
      })
      .join('\n\n'),
  }));
  return { invocations, tableData };
}

export default class ConfidenceTest extends Command {
  public static summary = 'Test the MCP server against the LLM Gateway API';
  public static description = `Tests that the MCP server tools are accurately invoked by various LLM models.

Configuration:
- Uses a YAML file to specify models and test cases
- Requires SF_MCP_CONFIDENCE_CONSUMER_KEY environment variable
- Requires SF_MCP_CONFIDENCE_CONSUMER_SECRET environment variable
- Requires SF_MCP_CONFIDENCE_INSTANCE_URL environment variable

At runtime, the SF_MCP_CONFIDENCE_CONSUMER_KEY and SF_MCP_CONFIDENCE_CONSUMER_SECRET are used to generate a JWT token from a External Client App in the production org (SF_MCP_CONFIDENCE_INSTANCE_URL).
This token is then used to authenticate requests to the LLM Gateway API.

YAML File Format:
The YAML file should contain:
- models: Array of model identifiers to test against
- initial-context: Optional array of strings to set the initial context for the conversation
- tests: Array of test objects with the following properties:
  - utterances: String or array of strings for test utterances (supports multi-turn conversations)
  - expected-tool: String identifying the expected tool to be invoked
  - expected-parameters: Optional object with expected parameter key-value pairs
  - expected-tool-confidence: Number representing the minimum confidence level (0-100)
  - expected-parameter-confidence: Optional number for parameter confidence (defaults to expected-tool-confidence)
  - allowed-tools: Optional array of tool names that are acceptable in addition to the expected tool

Example YAML structure:
models:
  - llmgateway__OpenAIGPT35Turbo_01_25
  - llmgateway__OpenAIGPT4OmniMini
tests:
  - utterances: "What's my salesforce username?"
    expected-tool: sf-org-display
    expected-tool-confidence: 80
  - utterances: ["I am a Salesforce developer", "Deploy my project"]
    expected-tool: sf-deploy-metadata
    expected-parameters:
      source-dir: "force-app"
    expected-tool-confidence: 90
    allowed-tools:
      - sf-list-all-orgs
  - utterances:
      - I am a Salesforce developer.
      - Deploy my project
    expected-tool: sf-deploy-metadata
    expected-tool-confidence: 85

For available models, see:
https://developer.salesforce.com/docs/einstein/genai/guide/supported-models.html`;

  public static flags = {
    file: Flags.file({
      summary: 'The YAML file to use for the response',
      description: 'Must contain array of models and test cases',
      required: true,
      exists: true,
      char: 'f',
    }),
    help: Flags.help({
      description: 'Show help',
      char: 'h',
    }),
    runs: Flags.integer({
      summary: 'Number of runs to use for confidence level',
      description: 'If specified, will run the tool multiple times to determine confidence level',
      default: 5,
      char: 'r',
    }),
    concise: Flags.boolean({
      summary: 'Suppress detailed output for each test run',
      description: 'If true, will print only the final results of each test run',
      default: false,
      char: 'c',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ConfidenceTest);

    const jwtToken = await mintJWT();

    const spec = Spec.safeParse(await readYamlFile<Spec>(flags.file));
    if (!spec.success) {
      this.error(`Invalid spec file: ${flags.file}\n${spec.error.message}`);
    }

    const { tools: mcpTools, tokens } = await getToolsList();
    if (!flags.concise) {
      stdout();
      printTable({
        title: 'Tools List',
        data: tokens,
        columns: [
          'tool',
          { key: 'tokensGPT4oMini', name: 'GPT 4o Mini' },
          { key: 'tokensO3Mini', name: 'O3 Mini' },
          { key: 'tokensGPT4', name: 'GPT 4' },
        ],
        titleOptions: {
          color: 'yellowBright',
        },
        ...TABLE_STYLE,
      });
      stdout();
    }

    const filteredTests = spec.data.tests.some((test) => test.only)
      ? [spec.data.tests.find((test) => test.only)!]
      : spec.data.tests.filter((test) => !test.skip);

    // Generate unique keys for each test case to track runs
    // This allows us to group runs by test case and display results clearly
    const testIndex = new Map<string, TestCase>();

    // Map to store test results by testCaseKey
    // Each entry will contain an array of runs for that test case
    // This allows us to aggregate results and print them after all runs are complete
    const testResultsByTestCaseKey = new Map<
      string,
      Array<{
        idx: number;
        testCaseKey: string;
        invocations: Record<string, Array<{ tool: string; parameters: Record<string, string> }>>;
        tableData: Array<{ model: Model; chat: string; tools: string }>;
      }>
    >();

    // Map to track pass/fail status by testCaseKey
    const passFailMap = new Map<string, { tools: boolean; parameters: boolean }>();

    const maybePrintTestResults = (testCaseKey: string): void => {
      const testRuns = (testResultsByTestCaseKey.get(testCaseKey) ?? []).sort((a, b) => a.idx - b.idx);
      if (testRuns.length < flags.runs) {
        return; // Not enough runs yet to print results
      }

      const testSpec = testIndex.get(testCaseKey);
      if (!testSpec) {
        stdout(colorize('red', `No test spec found for utterance key: ${testCaseKey}`));
        return;
      }

      stdout(colorize('bold', ' ─── Results for Test Case ───'));
      stdout(testSpec.readable);

      if (!flags.concise) {
        for (const run of testRuns) {
          printTable({
            title: `Run #${run.idx + 1}`,
            data: run.tableData,
            columns: [
              { key: 'model', width: '30%' },
              { key: 'chat', width: '40%' },
              { key: 'tools', width: '30%', name: 'Tool Invocations' },
            ],
            width: process.stdout.columns,
            ...TABLE_STYLE,
          });
        }
      }

      const runsByModel = groupBy(
        testRuns.flatMap((result) =>
          Object.entries(result.invocations).map(([model, invocations]) => ({
            model,
            invocations,
          }))
        ),
        (r) => r.model
      );

      printTable({
        title: 'Tool Invocations',
        data: Object.entries(runsByModel).map(([model, runs]) => {
          const actualToolCount = countRunsThatPassToolMatching(testSpec, runs);
          const totalRuns = runs.length;
          const confidence = Math.round((actualToolCount / totalRuns) * 100);

          if (confidence < testSpec.expectedToolConfidence) {
            passFailMap.set(testCaseKey, {
              ...(passFailMap.get(testCaseKey) ?? { tools: true, parameters: true }),
              tools: false,
            });
          }

          return {
            model,
            expectedTool: testSpec.expectedTool,
            actualTools: runs
              .map((r, idx) => `Run ${idx + 1}: ${r.invocations.flatMap((inv) => inv.tool).join(', ')}`)
              .join('\n'),
            count: `${actualToolCount}/${totalRuns}`,
            actualConfidence: `${confidence}%`,
            expectedConfidence: `${testSpec.expectedToolConfidence}%`,
            status: confidence >= testSpec.expectedToolConfidence ? colorize('green', 'PASS') : colorize('red', 'FAIL'),
          };
        }),
        columns: [
          { key: 'model', name: 'Model', width: '30%' },
          { key: 'expectedTool', name: 'Expected Tool Invocation', width: '15%' },
          { key: 'actualTools', name: 'Actual Tool Invocations', width: '25%' },
          { key: 'count', name: 'Count', width: '7%' },
          { key: 'expectedConfidence', name: 'Expected Confidence', width: '8%' },
          { key: 'actualConfidence', name: 'Actual Confidence', width: '8%' },
          { key: 'status', name: 'Status', width: '7%' },
        ],
        ...TABLE_STYLE,
        width: process.stdout.columns,
      });

      if (testSpec.expectedParameters) {
        printTable({
          title: 'Parameter Matching',
          data: Object.entries(runsByModel).map(([model, runs]) => {
            const runsThatMatchParameters = countRunsThatPassParameterMatching(testSpec, runs);
            const totalRuns = runs.length;
            const confidence = Math.round((runsThatMatchParameters / totalRuns) * 100);

            if (confidence < testSpec.expectedParameterConfidence) {
              passFailMap.set(testCaseKey, {
                ...(passFailMap.get(testCaseKey) ?? { tools: true, parameters: true }),
                parameters: false,
              });
            }

            return {
              model,
              count: `${runsThatMatchParameters}/${totalRuns}`,
              expectedParameters: makeReadableParameters(testSpec.expectedParameters ?? {}),
              actualParameters: runs
                .map(
                  (r, idx) =>
                    `Run ${idx + 1}:\n${makeReadableParameters(
                      r.invocations.find((inv) => inv.tool === testSpec.expectedTool)?.parameters ?? {}
                    )}`
                )
                .join('\n'),
              actualConfidence: `${confidence}%`,
              expectedConfidence: `${testSpec.expectedParameterConfidence}%`,
              status:
                confidence >= testSpec.expectedParameterConfidence
                  ? colorize('green', 'PASS')
                  : colorize('red', 'FAIL'),
            };
          }),
          columns: [
            { key: 'model', name: 'Model', width: '30%' },
            { key: 'expectedParameters', name: 'Expected Parameters', width: '15%' },
            { key: 'actualParameters', name: 'Actual Parameters', width: '25%' },
            { key: 'count', name: 'Count', width: '7%' },
            { key: 'expectedConfidence', name: 'Expected Confidence', width: '8%' },
            { key: 'actualConfidence', name: 'Actual Confidence', width: '8%' },
            { key: 'status', name: 'Status', width: '7%' },
          ],
          ...TABLE_STYLE,
          width: process.stdout.columns,
        });
      }
    };

    await Promise.all(
      filteredTests.flatMap((test) => {
        const testCaseKey = Math.random().toString(36).substring(2, 15);
        testIndex.set(testCaseKey, {
          readable: `${colorize('yellowBright', 'Utterance')}:\n  - ${castToArray(test.utterances).join('\n  - ')}`,
          utterances: castToArray(test.utterances),
          expectedTool: test['expected-tool'],
          expectedParameters: test['expected-parameters'],
          expectedToolConfidence: test['expected-tool-confidence'],
          expectedParameterConfidence: test['expected-parameter-confidence'] ?? test['expected-tool-confidence'],
          allowedTools: [test['expected-tool'], ...(test['allowed-tools'] ?? [])],
        });
        passFailMap.set(testCaseKey, {
          tools: true,
          parameters: true,
        });
        return Array.from({ length: flags.runs }, (_, idx) =>
          compareModelOutputs(jwtToken, test.utterances, spec.data, mcpTools).then(({ invocations, tableData }) => {
            testResultsByTestCaseKey.set(testCaseKey, [
              ...(testResultsByTestCaseKey.get(testCaseKey) ?? []),
              {
                idx,
                testCaseKey,
                invocations,
                tableData,
              },
            ]);
            maybePrintTestResults(testCaseKey);
          })
        );
      })
    );

    const failingToolTests = filterFailingTests(passFailMap, testIndex, 'tools');
    const failingParameterTests = filterFailingTests(passFailMap, testIndex, 'parameters');

    if (failingToolTests.length > 0) {
      stdout();
      stdout(colorize('red', 'Failed Tool Invocations'));
      stdout('The following test cases did not meet the tool invocation confidence level:');
      failingToolTests.forEach((test) => stdout(test?.readable ?? 'Unknown Test Case'));
      stdout();
    }

    if (failingParameterTests.length > 0) {
      stdout();
      stdout(colorize('red', 'Failed Parameter Matching'));
      stdout('The following test cases did not meet the parameter matching confidence level:');
      failingParameterTests.forEach((test) => stdout(test?.readable ?? 'Unknown Test Case'));
      stdout();
    }

    if (failingToolTests.length === 0 && failingParameterTests.length === 0) {
      stdout(colorize('green', 'All tests passed!'));
    } else {
      this.exit(1);
    }
  }
}
