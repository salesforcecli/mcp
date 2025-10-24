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

import { McpToolConfig, ReleaseState, Toolset } from '@salesforce/mcp-provider-api';
import { OfflineAnalysisTool } from '../../src/tools/offline-analysis/get_mobile_lwc_offline_analysis.js';
import { ExpertsCodeAnalysisIssuesType } from '../../src/schemas/analysisSchema.js';
import { LwcCodeType } from '../../src/schemas/lwcSchema.js';

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

describe('Tests for OfflineAnalysisTool', () => {
  let tool: OfflineAnalysisTool;

  beforeEach(() => {
    tool = new OfflineAnalysisTool();
  });

  it("When getReleaseState is called, then 'ga' is returned", () => {
    expect(tool.getReleaseState()).toEqual(ReleaseState.GA);
  });

  it("When getToolsets is called, then 'mobile' and 'mobile-core' are returned", () => {
    expect(tool.getToolsets()).toEqual([Toolset.MOBILE, Toolset.MOBILE_CORE]);
  });

  it("When getName is called, then 'get_mobile_lwc_offline_analysis' is returned", () => {
    expect(tool.getName()).toEqual('get_mobile_lwc_offline_analysis');
  });

  it('When getConfig is called, then the correct configuration is returned', () => {
    const config: McpToolConfig = tool.getConfig();
    expect(config.title).toEqual('Salesforce Mobile Offline LWC Expert Static Analysis');
    expect(config.description).toEqual(
      'Analyzes LWC components for mobile-specific issues and provides detailed recommendations for improvements. It can be leveraged to check if components are mobile-ready.',
    );
    expect(config.inputSchema).toBeTypeOf('object');
    expect(config.annotations).toEqual({ readOnlyHint: true });
  });

  describe('When exec is called with valid LWC code...', () => {
    let result: CallToolResult;
    const validLwcCode = {
      name: 'testComponent',
      namespace: 'c',
      html: [{ path: 'testComponent.html', content: '<template><div>Test</div></template>' }],
      js: [
        {
          path: 'testComponent.js',
          content:
            "import { LightningElement } from 'lwc'; export default class TestComponent extends LightningElement {}",
        },
      ],
      css: [{ path: 'testComponent.css', content: '.test { color: red; }' }],
      jsMetaXml: {
        path: 'testComponent.js-meta.xml',
        content:
          '<?xml version="1.0" encoding="UTF-8"?><LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>58.0</apiVersion><isExposed>true</isExposed></LightningComponentBundle>',
      },
    };

    beforeEach(async () => {
      result = await tool.exec(validLwcCode);
    });

    it('... then a valid result is returned', () => {
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0]).toHaveProperty('text');
      expect(typeof result.content[0].text).toBe('string');
    });

    it('... then structured content is returned', () => {
      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toHaveProperty('analysisResults');
      expect(Array.isArray((result.structuredContent as ExpertsCodeAnalysisIssuesType).analysisResults)).toBe(true);
    });
  });

  describe('When exec is called with invalid input...', () => {
    let result: CallToolResult;

    beforeEach(async () => {
      // Simulate an error by passing invalid input
      result = await tool.exec({} as LwcCodeType);
    });

    it('... then an error result is returned', () => {
      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('Failed to analyze code');
    });
  });

  describe('When analyzeCode is called directly...', () => {
    const testCode = {
      name: 'testComponent',
      namespace: 'c',
      html: [{ path: 'testComponent.html', content: '<template><div>Test</div></template>' }],
      js: [
        {
          path: 'testComponent.js',
          content:
            "import { LightningElement } from 'lwc'; export default class TestComponent extends LightningElement {}",
        },
      ],
      css: [{ path: 'testComponent.css', content: '.test { color: red; }' }],
      jsMetaXml: {
        path: 'testComponent.js-meta.xml',
        content:
          '<?xml version="1.0" encoding="UTF-8"?><LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>58.0</apiVersion><isExposed>true</isExposed></LightningComponentBundle>',
      },
    };

    it('... then analysis results are returned', async () => {
      const result = await tool.analyzeCode(testCode);
      expect(result).toHaveProperty('analysisResults');
      expect(result).toHaveProperty('orchestrationInstructions');
      expect(Array.isArray(result.analysisResults)).toBe(true);
      expect(typeof result.orchestrationInstructions).toBe('string');
    });
  });

  describe('When analyzeCode is called with code that triggers ESLint violations...', () => {
    const codeWithViolations = {
      name: 'testComponent',
      namespace: 'c',
      html: [{ path: 'testComponent.html', content: '<template><div>Test</div></template>' }],
      js: [
        {
          path: 'testComponent.js',
          content: `
          import { LightningElement, wire } from 'lwc';
          import { getRecord } from 'lightning/uiRecordApi';
          
          export default class TestComponent extends LightningElement {
            @wire(getRecord, {
              recordId: '$recordId',
              fields: ['Account.Name']
            })
            wiredRecord;
          }
        `,
        },
      ],
      css: [{ path: 'testComponent.css', content: '.test { color: red; }' }],
      jsMetaXml: {
        path: 'testComponent.js-meta.xml',
        content:
          '<?xml version="1.0" encoding="UTF-8"?><LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>58.0</apiVersion><isExposed>true</isExposed></LightningComponentBundle>',
      },
    };

    it('... then issues are created and analyzed', async () => {
      const result = await tool.analyzeCode(codeWithViolations);
      expect(result).toHaveProperty('analysisResults');
      expect(Array.isArray(result.analysisResults)).toBe(true);
      expect(result.analysisResults.length).toBeGreaterThan(0);

      // Check that the expert reviewer name is set
      const analysisResult = result.analysisResults[0];
      expect(analysisResult).toHaveProperty('expertReviewerName', 'Mobile Web Offline Analysis');
      expect(analysisResult).toHaveProperty('issues');
      expect(Array.isArray(analysisResult.issues)).toBe(true);
    });
  });

  describe('When extractCodeSnippet is called...', () => {
    const testCode = 'line1\nline2\nline3\nline4\nline5';

    it('... then the correct code snippet is extracted for single line', () => {
      // @ts-expect-error - Testing private method
      const result = tool.extractCodeSnippet(testCode, 2, 2);
      expect(result).toBe('line2');
    });

    it('... then the correct code snippet is extracted for multiple lines', () => {
      // @ts-expect-error - Testing private method
      const result = tool.extractCodeSnippet(testCode, 2, 4);
      expect(result).toBe('line2\nline3\nline4');
    });

    it('... then the correct code snippet is extracted for first line', () => {
      // @ts-expect-error - Testing private method
      const result = tool.extractCodeSnippet(testCode, 1, 1);
      expect(result).toBe('line1');
    });

    it('... then the correct code snippet is extracted for last line', () => {
      // @ts-expect-error - Testing private method
      const result = tool.extractCodeSnippet(testCode, 5, 5);
      expect(result).toBe('line5');
    });
  });
});
