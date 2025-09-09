/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import { z } from 'zod';

const ExpertReviewerNameSchema = z
  .string()
  .describe(
    'The title-cased name of the reviewer providing the review instructions, representing a brief description of the functional area meant to be reviewed.'
  );

export const CodeAnalysisBaseIssueSchema = z.object({
  type: z.string().describe('Categorize the issue'),
  description: z.string().describe('Why this is an issue?'),
  intentAnalysis: z.string().describe('What is the likely intent of the developer?'),
  suggestedAction: z
    .string()
    .describe(
      `How a developer should address the issue? Be as detailed as possible without adding code snippets.`
    ),
});

export const CodeAnalysisIssueSchema = CodeAnalysisBaseIssueSchema.extend({
  code: z.string().optional().describe('What is the code snippet with the issue?'),
  location: z
    .object({
      startLine: z.number().gte(0),
      endLine: z.number().gte(0).optional(),
      startColumn: z.number().gte(0).optional(),
      endColumn: z.number().gte(0).optional(),
    })
    .describe('Provide the exact line number(s) and column number(s) where the issue occurs'),
});

export const CodeAnalysisIssuesSchema = z
  .array(CodeAnalysisIssueSchema)
  .describe('Specific issues found during the analysis. Should be empty if no issues were found.');

export const ExpertCodeAnalysisIssuesSchema = z.object({
  expertReviewerName: ExpertReviewerNameSchema,
  issues: CodeAnalysisIssuesSchema,
});

export const ExpertsCodeAnalysisIssuesSchema = z.object({
  analysisResults: z
    .array(ExpertCodeAnalysisIssuesSchema)
    .min(1)
    .describe(
      'An array of expert reviews of the code, each outlining specific issues found during analysis.'
    ),
  orchestrationInstructions: z
    .string()
    .default(
      "If you have not already executed the 'sfmobile-web-offline-guidance' tool in this conversation thread: (1) Immediately call the 'sfmobile-web-offline-guidance' tool, (2) Execute all review instructions from the guidance tool's output against the user's LWC component code in the specified format, (3) Combine the review results from step 2 with this tool's analysis results, then refactor the component based on all combined review recommendations."
    )
    .describe(
      'Instructions for the MCP client on how to orchestrate this tool with the companion guidance tool for comprehensive offline compatibility review.'
    ),
});

// Schema for expected response format that separates schema from input values
const ExpectedResponseFormatSchema = z.object({
  schema: z.record(z.any()).describe('The JSON schema definition for the expected response format'),
  inputValues: z
    .object({
      expertReviewerName: ExpertReviewerNameSchema,
    })
    .describe('Specific values that should be used as inputs when constructing the response'),
});

// Review Instructions Schema for Agentic Analysis
const ExpertReviewInstructionsSchema = z.object({
  expertReviewerName: ExpertReviewerNameSchema,
  supportedFileTypes: z
    .array(z.enum(['JS', 'HTML', 'CSS']))
    .min(1)
    .describe(
      'The list of file types this review should apply to. All content for these files types should be reviewed.'
    ),
  grounding: z.string().describe('The grounding context that will apply to this expert review.'),
  request: z.string().describe('The formal review request instructions for the expert review.'),
  expectedResponseFormat: ExpectedResponseFormatSchema.describe(
    "The required schema format and input values for the LLM's review response."
  ),
});

export const ExpertsReviewInstructionsSchema = z.object({
  reviewInstructions: z
    .array(ExpertReviewInstructionsSchema)
    .min(1)
    .describe(
      'An array of LLM-directed instructions to conduct expert reviews of code with supported file types, grounding context, and request fields for processing.'
    ),
  orchestrationInstructions: z
    .string()
    .default(
      "If you have not already executed the 'sfmobile-web-offline-analysis' tool in this conversation thread: (1) Execute all review instructions provided in this response against the user's LWC component code, producing structured review results in the specified format, (2) Immediately call the 'sfmobile-web-offline-analysis' tool with the user's component code as input, (3) Combine your review results from step 1 with the analysis results from step 2, then refactor the component based on all combined review recommendations."
    )
    .describe(
      'Instructions for the MCP client on how to orchestrate this tool with the companion analysis tool for comprehensive offline compatibility review.'
    ),
});

export type CodeAnalysisIssueType = z.infer<typeof CodeAnalysisIssueSchema>;
export type CodeAnalysisIssuesType = z.infer<typeof CodeAnalysisIssuesSchema>;
export type CodeAnalysisBaseIssueType = z.infer<typeof CodeAnalysisBaseIssueSchema>;
export type ExpertCodeAnalysisIssuesType = z.infer<typeof ExpertCodeAnalysisIssuesSchema>;
export type ExpertsCodeAnalysisIssuesType = z.infer<typeof ExpertsCodeAnalysisIssuesSchema>;
export type ExpectedResponseFormatType = z.infer<typeof ExpectedResponseFormatSchema>;
export type ExpertReviewInstructionsType = z.infer<typeof ExpertReviewInstructionsSchema>;
export type ExpertsReviewInstructionsType = z.infer<typeof ExpertsReviewInstructionsSchema>;
