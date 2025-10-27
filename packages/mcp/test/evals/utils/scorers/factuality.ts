import { google } from '@ai-sdk/google';
import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';

// Supported models: https://ai.google.dev/gemini-api/docs/models
const defaultModel = google('gemini-2.5-flash');

/**
 * A Factuality checker utilizing the `ai` SDK based on the implementation in `autoevals`.
 *
 * ```
 * import { openai } from "@ai-sdk/openai";
 *
 * scorers: [Factuality(openai("gpt-4o"))]
 * ```
 */
export function Factuality(model: LanguageModel = defaultModel) {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  return async function Factuality(opts: { input: string; output: string; expected?: string }) {
    const { object } = await generateObject({
      model,
      /**
       * Prompt implementation from `autoevals`:
       *
       * {@link https://github.com/braintrustdata/autoevals/blob/5aa20a0a9eb8fc9e07e9e5722ebf71c68d082f32/templates/factuality.yaml}
       */
      prompt: `
        You are comparing a submitted answer to an expert answer on a given question. Here is the data:
        [BEGIN DATA]
        ************
        [Question]: ${opts.input}
        ************
        [Expert]: ${opts.expected}
        ************
        [Submission]: ${opts.output}
        ************
        [END DATA]
        Compare the factual content of the submitted answer with the expert answer. Ignore any differences in style, grammar, or punctuation, or overall structure.
        The submitted answer may either be a subset or superset of the expert answer, or it may conflict with it. Determine which case applies. Answer the question by selecting one of the following options:
        
        (A) The submitted answer is a subset of the expert answer and is fully consistent with it.
        (B) The submitted answer is a superset of the expert answer and is fully consistent with it.
        (C) The submitted answer contains all the same details as the expert answer.
        (D) There is a disagreement between the submitted answer and the expert answer.
        (E) The answers differ, but these differences don't matter from the perspective of factuality.
      `,
      schema: z.object({
        answer: z.enum(['A', 'B', 'C', 'D', 'E']).describe('Your selection.'),
        rationale: z.string().describe('Why you chose this answer. Be very detailed.'),
      }),
    });

    const scores = {
      A: 0.4,
      B: 0.6,
      C: 1,
      D: 0,
      E: 1,
    };

    return {
      score: scores[object.answer],
      metadata: {
        rationale: object.rationale,
      },
    };
  };
}
