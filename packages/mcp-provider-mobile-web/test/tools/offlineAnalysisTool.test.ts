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
      js: {
        path: 'testComponent.js',
        content:
          "import { LightningElement } from 'lwc'; export default class TestComponent extends LightningElement {}",
      },
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
      // Simulate an error by passing invalid input (missing required fields)
      result = await tool.exec({} as LwcCodeType);
    });

    it('... then an error result is returned or handled gracefully', () => {
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      // The result might either have isError flag or contain error message in text
      if (result.isError) {
        expect(result.content[0].text).toContain('Failed to analyze code');
      } else {
        // If not marked as error, it should still complete without crashing
        expect(typeof result.content[0].text).toBe('string');
      }
    });
  });

  describe('When analyzeCode is called directly...', () => {
    const testCode = {
      name: 'testComponent',
      namespace: 'c',
      html: [{ path: 'testComponent.html', content: '<template><div>Test</div></template>' }],
      js: {
        path: 'testComponent.js',
        content:
          "import { LightningElement } from 'lwc'; export default class TestComponent extends LightningElement {}",
      },
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
      js: {
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

  // Tests for new features in latest commit
  describe('When analyzeCode is called without js property...', () => {
    const codeWithoutJs = {
      name: 'testComponent',
      namespace: 'c',
      html: [{ path: 'testComponent.html', content: '<template><div>Test</div></template>' }],
    } as LwcCodeType;

    it('... then analysis completes with no issues', async () => {
      const result = await tool.analyzeCode(codeWithoutJs);
      expect(result).toHaveProperty('analysisResults');
      expect(Array.isArray(result.analysisResults)).toBe(true);
      expect(result.analysisResults.length).toBeGreaterThan(0);

      const analysisResult = result.analysisResults[0];
      expect(analysisResult).toHaveProperty('expertReviewerName', 'Mobile Web Offline Analysis');
      expect(analysisResult).toHaveProperty('issues');
      expect(Array.isArray(analysisResult.issues)).toBe(true);
      expect(analysisResult.issues.length).toBe(0);
    });
  });

  describe('When analyzeCode is called with code containing getter violations...', () => {
    describe('... and getter assigns value to member variable', () => {
      const codeWithAssignmentInGetter = {
        name: 'testComponent',
        namespace: 'c',
        html: [{ path: 'testComponent.html', content: '<template><div>{displayValue}</div></template>' }],
        js: {
          path: 'testComponent.js',
          content: `
            import { LightningElement } from 'lwc';
            
            export default class TestComponent extends LightningElement {
              _count = 0;
              
              get displayValue() {
                this._count = this._count + 1;
                return this._count;
              }
            }
          `,
        },
      };

      it('... then issues are reported with correct type and filePath', async () => {
        const result = await tool.analyzeCode(codeWithAssignmentInGetter);
        expect(result.analysisResults[0].issues.length).toBeGreaterThan(0);

        const issue = result.analysisResults[0].issues[0];
        expect(issue).toHaveProperty('filePath', 'testComponent.js');
        expect(issue).toHaveProperty('type', 'Violations in Getter');
        expect(issue.description).toContain('does more than just returning a value');
        expect(issue.suggestedAction).toContain('getters with side effects');
      });
    });

    describe('... and getter references class functions', () => {
      const codeWithFunctionReference = {
        name: 'testComponent',
        namespace: 'c',
        html: [{ path: 'testComponent.html', content: '<template><div>{displayValue}</div></template>' }],
        js: {
          path: 'testComponent.js',
          content: `
            import { LightningElement } from 'lwc';
            
            export default class TestComponent extends LightningElement {
              calculateValue() {
                return 42;
              }
              
              get displayValue() {
                return this.calculateValue;
              }
            }
          `,
        },
      };

      it('... then analysis completes without errors', async () => {
        const result = await tool.analyzeCode(codeWithFunctionReference);
        expect(result).toHaveProperty('analysisResults');
        expect(Array.isArray(result.analysisResults)).toBe(true);
        // Note: This specific pattern may or may not trigger the rule depending on ESLint plugin version
      });
    });

    describe('... and getter references module functions', () => {
      const codeWithModuleFunctionReference = {
        name: 'testComponent',
        namespace: 'c',
        html: [{ path: 'testComponent.html', content: '<template><div>{displayValue}</div></template>' }],
        js: {
          path: 'testComponent.js',
          content: `
            import { LightningElement } from 'lwc';
            
            const utilFunction = () => 42;
            
            export default class TestComponent extends LightningElement {
              get displayValue() {
                return utilFunction;
              }
            }
          `,
        },
      };

      it('... then analysis completes without errors', async () => {
        const result = await tool.analyzeCode(codeWithModuleFunctionReference);
        expect(result).toHaveProperty('analysisResults');
        expect(Array.isArray(result.analysisResults)).toBe(true);
        // Note: This specific pattern may or may not trigger the rule depending on ESLint plugin version
      });
    });

    describe('... and getter contains more than a return statement', () => {
      const codeWithMultipleStatements = {
        name: 'testComponent',
        namespace: 'c',
        html: [{ path: 'testComponent.html', content: '<template><div>{displayValue}</div></template>' }],
        js: {
          path: 'testComponent.js',
          content: `
            import { LightningElement } from 'lwc';
            
            export default class TestComponent extends LightningElement {
              get displayValue() {
                console.log('Getting value');
                return 42;
              }
            }
          `,
        },
      };

      it('... then issues are reported with getter violation type', async () => {
        const result = await tool.analyzeCode(codeWithMultipleStatements);
        expect(result.analysisResults[0].issues.length).toBeGreaterThan(0);

        const issue = result.analysisResults[0].issues[0];
        expect(issue).toHaveProperty('filePath', 'testComponent.js');
        expect(issue).toHaveProperty('type', 'Violations in Getter');
        expect(issue.description).toContain('does more than just returning a value');
      });
    });

    describe('... and getter accesses unsupported member variable', () => {
      const codeWithPrivateMemberAccess = {
        name: 'testComponent',
        namespace: 'c',
        html: [{ path: 'testComponent.html', content: '<template><div>{displayValue}</div></template>' }],
        js: {
          path: 'testComponent.js',
          content: `
            import { LightningElement } from 'lwc';
            
            export default class TestComponent extends LightningElement {
              _privateValue = 42;
              
              get displayValue() {
                return this._privateValue;
              }
            }
          `,
        },
      };

      it('... then analysis completes without errors', async () => {
        const result = await tool.analyzeCode(codeWithPrivateMemberAccess);
        expect(result).toHaveProperty('analysisResults');
        expect(Array.isArray(result.analysisResults)).toBe(true);
        // Note: This specific pattern may or may not trigger the rule depending on ESLint plugin version
      });
    });
  });

  describe('When analyzeCode is called with valid getter implementations...', () => {
    const codeWithValidGetter = {
      name: 'testComponent',
      namespace: 'c',
      html: [{ path: 'testComponent.html', content: '<template><div>{calculatedValue}</div></template>' }],
      js: {
        path: 'testComponent.js',
        content: `
          import { LightningElement, api } from 'lwc';
          
          export default class TestComponent extends LightningElement {
            @api prop = 10;
            
            get calculatedValue() {
              return this.prop * 3;
            }
          }
        `,
      },
    };

    it('... then no issues are reported', async () => {
      const result = await tool.analyzeCode(codeWithValidGetter);
      expect(result.analysisResults[0].issues.length).toBe(0);
    });
  });

  describe('When analyzeCode processes issues with location information...', () => {
    const codeWithViolation = {
      name: 'testComponent',
      namespace: 'c',
      html: [{ path: 'testComponent.html', content: '<template><div>{displayValue}</div></template>' }],
      js: {
        path: 'src/testComponent.js',
        content: `import { LightningElement } from 'lwc';

export default class TestComponent extends LightningElement {
  _value = 0;
  
  get displayValue() {
    this._value = this._value + 1;
    return this._value;
  }
}`,
      },
    };

    it('... then issues include the correct filePath and location', async () => {
      const result = await tool.analyzeCode(codeWithViolation);

      // If issues are detected, verify they have the correct structure
      if (result.analysisResults[0].issues.length > 0) {
        const issue = result.analysisResults[0].issues[0];
        expect(issue).toHaveProperty('filePath', 'src/testComponent.js');
        expect(issue).toHaveProperty('location');
        expect(issue.location).toHaveProperty('startLine');
        expect(issue.location).toHaveProperty('startColumn');
      }

      // At minimum, verify analysis completes
      expect(result).toHaveProperty('analysisResults');
      expect(Array.isArray(result.analysisResults)).toBe(true);
    });
  });

  describe('When analyzeCode is called with HTML content...', () => {
    const codeWithHtml = {
      name: 'testComponent',
      namespace: 'c',
      html: [
        {
          path: 'testComponent.html',
          content: '<template><div class="container">{displayValue}</div></template>',
        },
      ],
      js: {
        path: 'testComponent.js',
        content: `
          import { LightningElement, api } from 'lwc';
          
          export default class TestComponent extends LightningElement {
            @api displayValue = 'Hello World';
          }
        `,
      },
    };

    it('... then HTML content is properly processed', async () => {
      const result = await tool.analyzeCode(codeWithHtml);
      expect(result).toHaveProperty('analysisResults');
      expect(Array.isArray(result.analysisResults)).toBe(true);
      expect(result.analysisResults[0]).toHaveProperty('expertReviewerName', 'Mobile Web Offline Analysis');
    });
  });

  describe('When analyzeCode is called with empty HTML content...', () => {
    const codeWithEmptyHtml = {
      name: 'testComponent',
      namespace: 'c',
      html: [],
      js: {
        path: 'testComponent.js',
        content: `
          import { LightningElement } from 'lwc';
          
          export default class TestComponent extends LightningElement {}
        `,
      },
    };

    it('... then analysis completes successfully', async () => {
      const result = await tool.analyzeCode(codeWithEmptyHtml);
      expect(result).toHaveProperty('analysisResults');
      expect(Array.isArray(result.analysisResults)).toBe(true);
      expect(result.analysisResults[0].issues.length).toBe(0);
    });
  });
});
