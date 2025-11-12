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

import { Linter } from 'eslint';
import { McpTool, type McpToolConfig } from '@salesforce/mcp-provider-api';
import { ReleaseState, Toolset } from '@salesforce/mcp-provider-api';
import { LwcCodeSchema, type LwcCodeType } from '../../schemas/lwcSchema.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import lwcGraphAnalyzerPlugin from '@salesforce/eslint-plugin-lwc-graph-analyzer';
import { ruleConfigs } from './ruleConfig.js';

import {
  CodeAnalysisBaseIssueType,
  CodeAnalysisIssueType,
  ExpertsCodeAnalysisIssuesSchema,
  ExpertsCodeAnalysisIssuesType,
  ExpertCodeAnalysisIssuesType,
} from '../../schemas/analysisSchema.js';

const ANALYSIS_EXPERT_NAME = 'Mobile Web Offline Analysis';
const PLUGIN_NAME = '@salesforce/lwc-graph-analyzer';
const RECOMMENDED_CONFIG = lwcGraphAnalyzerPlugin.configs.recommended;
const { bundleAnalyzer } = lwcGraphAnalyzerPlugin.processors;

const LINTER_CONFIG: Linter.Config = {
  name: `config: ${PLUGIN_NAME}`,
  plugins: {
    [PLUGIN_NAME]: lwcGraphAnalyzerPlugin,
  },
  ...RECOMMENDED_CONFIG,
};

type InputArgsShape = typeof LwcCodeSchema.shape;
type OutputArgsShape = typeof ExpertsCodeAnalysisIssuesSchema.shape;

export class OfflineAnalysisTool extends McpTool<InputArgsShape, OutputArgsShape> {
  private readonly linter: Linter;
  private readonly ruleReviewers: Record<string, CodeAnalysisBaseIssueType>;

  constructor() {
    super();
    this.linter = new Linter({ configType: 'flat' });
    this.ruleReviewers = this.initializeRuleReviewers();
  }

  public getReleaseState(): ReleaseState {
    return ReleaseState.GA;
  }

  public getToolsets(): Toolset[] {
    return [Toolset.MOBILE, Toolset.MOBILE_CORE];
  }

  public getName(): string {
    return 'get_mobile_lwc_offline_analysis';
  }

  public getConfig(): McpToolConfig<InputArgsShape, OutputArgsShape> {
    return {
      title: 'Salesforce Mobile Offline LWC Expert Static Analysis',
      description:
        'Analyzes LWC components for mobile-specific issues and provides detailed recommendations for improvements. It can be leveraged to check if components are mobile-ready.',
      inputSchema: LwcCodeSchema.shape,
      outputSchema: ExpertsCodeAnalysisIssuesSchema.shape,
      annotations: {
        readOnlyHint: true,
      },
    };
  }

  public async exec(args: LwcCodeType): Promise<CallToolResult> {
    try {
      const analysisResults = await this.analyzeCode(args);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(analysisResults),
          },
        ],
        structuredContent: analysisResults,
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Failed to analyze code: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  private initializeRuleReviewers(): Record<string, CodeAnalysisBaseIssueType> {
    return ruleConfigs.reduce(
      (acc, ruleConfig) => {
        acc[ruleConfig.id] = ruleConfig.config;
        return acc;
      },
      {} as Record<string, CodeAnalysisBaseIssueType>,
    );
  }

  public async analyzeCode(code: LwcCodeType): Promise<ExpertsCodeAnalysisIssuesType> {
    let offlineAnalysisIssues: ExpertCodeAnalysisIssuesType;

    if (!code.js) {
      offlineAnalysisIssues = {
        expertReviewerName: ANALYSIS_EXPERT_NAME,
        issues: [],
      };
    } else {
      const jsCode = code.js.content;
      const jsPath = code.js.path;

      const htmlCodes = code.html.length > 0 ? code.html.map((html) => html.content) : ([''] as string[]);

      const baseName = code.name;

      bundleAnalyzer.setLwcBundleFromContent(baseName, jsCode, ...htmlCodes);

      const { messages } = this.linter.verifyAndFix(jsCode, LINTER_CONFIG, {
        fix: true,
        filename: `${baseName}.js`,
      });

      offlineAnalysisIssues = this.analyzeIssues(jsCode, messages, jsPath);
    }

    return {
      analysisResults: [offlineAnalysisIssues],
      orchestrationInstructions: this.getOrchestrationInstructions(),
    };
  }

  private getOrchestrationInstructions(): string {
    return ExpertsCodeAnalysisIssuesSchema.shape.orchestrationInstructions.parse(undefined);
  }

  private analyzeIssues(code: string, messages: Linter.LintMessage[], jsPath: string): ExpertCodeAnalysisIssuesType {
    const issues: CodeAnalysisIssueType[] = [];

    for (const violation of messages) {
      const { ruleId, line, column, endLine, endColumn } = violation;
      if (!ruleId) continue;
      const ruleReviewer = this.ruleReviewers[ruleId];

      if (ruleReviewer) {
        const issue: CodeAnalysisIssueType = {
          filePath: jsPath,
          type: ruleReviewer.type,
          description: ruleReviewer.description,
          intentAnalysis: ruleReviewer.intentAnalysis,
          suggestedAction: ruleReviewer.suggestedAction,
          code: this.extractCodeSnippet(code, line, endLine ?? line),
          location: {
            startLine: line,
            startColumn: column,
            endLine: endLine,
            endColumn: endColumn,
          },
        };
        issues.push(issue);
      }
    }

    return {
      expertReviewerName: ANALYSIS_EXPERT_NAME,
      issues: issues,
    };
  }

  private extractCodeSnippet(code: string, startLine: number, endLine: number): string {
    return code
      .split('\n')
      .slice(startLine - 1, endLine)
      .join('\n');
  }
}
