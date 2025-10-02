import { experimental_createMCPClient, generateObject, type LanguageModel } from 'ai';
import { Experimental_StdioMCPTransport } from 'ai/mcp-stdio';
import { google } from '@ai-sdk/google';
import * as path from 'node:path';
import { z } from 'zod';

// Supported models: https://ai.google.dev/gemini-api/docs/models
const defaultModel = google('gemini-2.5-flash');

let cachedTools: string[] | null = null;

const predictionSchema = z.object({
  score: z.number().min(0).max(1).describe('Score from 0 to 1'),
  rationale: z.string().describe('Explanation of the score'),
  predictedTools: z
    .array(
      z.object({
        name: z.string(),
        arguments: z.unknown().optional(),
        // arguments: z.record(z.any()).optional().default({}),
      })
    )
    .describe('What tools the AI would likely call'),
});

interface ToolPredictionScorerOptions {
  input: string;
  output: string;
  expectedTools?: ExpectedToolCall[];
  result?: any;
}

export interface ExpectedToolCall {
  name: string;
  arguments: Record<string, any>;
}

export function ToolPredictionScorer(model: LanguageModel = defaultModel) {
  return async function ToolPredictionScorer(opts: ToolPredictionScorerOptions) {
    // If expectedTools is not defined, skip this scorer
    if (!opts.expectedTools) {
      return {
        score: null,
        metadata: {
          rationale: 'Skipped: No expectedTools defined for this test case',
        },
      };
    }

    const expectedTools = opts.expectedTools;

    // Get available tools from the MCP server
    // TODO(cristian): validate that all expected tools are included here, throw if not.
    const AVAILABLE_TOOLS = await getAvailableTools();

    // Generate a description of the expected tools for the prompt
    const expectedDescription = expectedTools
      .map((tool) => `- ${tool.name} with arguments: ${JSON.stringify(tool.arguments)}`)
      .join('\n');

    const { object } = await generateObject({
      model,
      prompt: generateSystemPrompt(AVAILABLE_TOOLS, opts.input, expectedDescription),
      maxRetries: 0,
      schema: predictionSchema,
      experimental_telemetry: {
        isEnabled: false,
      },
    });
    // console.log('*'.repeat(process.stdout.columns))
    // console.log(AVAILABLE_TOOLS)
    // console.log('*'.repeat(process.stdout.columns))
    // console.log(JSON.stringify(object,null,2))
    // console.log('*'.repeat(process.stdout.columns))

    return {
      score: object.score,
      metadata: {
        rationale: object.rationale,
        predictedTools: object.predictedTools,
        expectedTools: expectedTools,
      },
    };
  };
}

async function getAvailableTools(): Promise<string[]> {
  if (cachedTools) {
    return cachedTools;
  }

  const client = await experimental_createMCPClient({
    transport: new Experimental_StdioMCPTransport({
      command: 'node',
      args: [
        path.join(import.meta.dirname, '../../../mcp/bin/run.js'),
        '--toolsets',
        'orgs,metadata,testing',
        '-o',
        'DEFAULT_TARGET_ORG',
        '--no-telemetry',
        '--allow-non-ga-tools',
      ],
    }),
  });

  // Discover available tools
  const toolsMap = await client.tools();

  // TODO(cristian): this should include full tool desc and params
  // Convert tools to the format expected by the scorer
  cachedTools = Object.entries(toolsMap).map(([name, tool]) => {
    // Extract the first line of description for a concise summary
    const shortDescription = tool.description || '';
    const params = tool.parameters
    return `${name} - ${shortDescription}\n${JSON.stringify(params)}`;
  });

  // Clean up
  await client.close();
  // console.log(JSON.stringify(cachedTools,null,2));

  return cachedTools;
}

function generateSystemPrompt(availableTools: string[], task: string, expectedDescription: string): string {
  return `
You are evaluating whether an AI assistant with access to Salesforce DX MCP tools would make the correct tool calls for a given task.

[AVAILABLE TOOLS]
${availableTools.join('\n')}

[TASK]
${task}

[EXPECTED TOOL CALLS]
${expectedDescription}

<toolUseInstructions>
When using a tool, follow the JSON schema very carefully and make sure to include ALL required properties.
</toolUseInstructions>

Your goal is to evaluate whether the AI assistant would behave correctly based on:
- The user’s task (intent)
- The list of available tools and their documented behavior
- The arguments required by each tool

IMPORTANT:
- The provided [EXPECTED TOOL CALLS] represents what *should* happen in this specific test case, *assuming it is valid*.
- **If the expected tools are not appropriate for the task or violate the available tool definitions (e.g., wrong tool for the intent, required params missing, invalid params present), score based on correctness, not blind matching.**

STRICT VALIDATION RULES:
1. You may ONLY use tools listed under [AVAILABLE TOOLS]. If an expected tool is not listed, the test is invalid — score accordingly.
2. Match the user’s task with the most appropriate tool(s) based on the tool definitions and parameter requirements.
3. Validate each predicted tool call:
   - Tool name must be correct for the task
   - All required arguments must be present
   - No unexpected or invalid arguments
   - Tool must be available in the [AVAILABLE TOOLS] list

SCORING:
- 1.0: All predicted tool calls are correct for the task, use valid tools, and match the expected tool behavior exactly
- 0.8: Minor argument mismatches (e.g., extra but harmless params)
- 0.6: Correct tools used but wrong order or missing some arguments
- 0.3: Some correct tools but major issues (e.g. wrong tool order, invalid args)
- 0.0: Critical mistakes: wrong tools for the task, missing essential tools, or tools not in the available list

NOTE:
- The goal is not to blindly reproduce the expected tool calls, but to validate whether the expected behavior is appropriate and executable given the available tools and the task.
- If the expected tool call includes incorrect tools or invalid arguments, reduce the score appropriately.

Current open workspace: "${process.env.SF_EVAL_PROMPT_PROJECT_DIR}"
Current open file: "${process.env.SF_EVAL_PROMPT_OPEN_FILEPATH}"
`;
}
