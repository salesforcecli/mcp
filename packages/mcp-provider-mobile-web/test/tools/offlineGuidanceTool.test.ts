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
import { OfflineGuidanceTool } from '../../src/tools/offline-guidance/get_mobile_lwc_offline_guidance.js';
import { ExpertsReviewInstructionsType } from '../../src/schemas/analysisSchema.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

describe('Tests for OfflineGuidanceTool', () => {
  let tool: OfflineGuidanceTool;

  beforeEach(() => {
    tool = new OfflineGuidanceTool();
  });

  it("When getReleaseState is called, then 'ga' is returned", () => {
    expect(tool.getReleaseState()).toEqual(ReleaseState.GA);
  });

  it("When getToolsets is called, then 'mobile' and 'mobile-core' are returned", () => {
    expect(tool.getToolsets()).toEqual([Toolset.MOBILE, Toolset.MOBILE_CORE]);
  });

  it("When getName is called, then 'get_mobile_lwc_offline_guidance' is returned", () => {
    expect(tool.getName()).toEqual('get_mobile_lwc_offline_guidance');
  });

  it('When getConfig is called, then the correct configuration is returned', () => {
    const config: McpToolConfig = tool.getConfig();
    expect(config.title).toEqual('Salesforce Mobile Offline LWC Expert Instruction Delivery');
    expect(config.description).toEqual(
      'Provides structured review instructions to detect and remediate Mobile Offline code violations in Lightning web components (LWCs) for Salesforce Mobile Apps.',
    );
    expect(config.inputSchema).toBeTypeOf('object');
    expect(config.annotations).toEqual({ readOnlyHint: true });
  });

  describe('When exec is called...', () => {
    let result: CallToolResult;

    beforeEach(async () => {
      result = await tool.exec({});
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
      expect(result.structuredContent).toHaveProperty('reviewInstructions');
      expect(result.structuredContent).toHaveProperty('orchestrationInstructions');
      expect(Array.isArray((result.structuredContent as ExpertsReviewInstructionsType).reviewInstructions)).toBe(true);
    });
  });

  describe('When getExpertReviewInstructions is called directly...', () => {
    it('... then review instructions are returned', () => {
      const instructions = tool.getExpertReviewInstructions();
      expect(instructions).toHaveProperty('reviewInstructions');
      expect(instructions).toHaveProperty('orchestrationInstructions');
      expect(Array.isArray(instructions.reviewInstructions)).toBe(true);
      expect(typeof instructions.orchestrationInstructions).toBe('string');

      // Check that we have the expected expert reviewers
      expect(instructions.reviewInstructions.length).toBeGreaterThan(0);
      const expertNames = instructions.reviewInstructions.map((r) => r.expertReviewerName);
      expect(expertNames).toContain('Conditional Rendering Compatibility Expert');
      expect(expertNames).toContain('GraphQL Wire Configuration Expert');
    });

    it('... then each review instruction has the required properties', () => {
      const instructions = tool.getExpertReviewInstructions();

      instructions.reviewInstructions.forEach((instruction) => {
        expect(instruction).toHaveProperty('expertReviewerName');
        expect(instruction).toHaveProperty('supportedFileTypes');
        expect(instruction).toHaveProperty('grounding');
        expect(instruction).toHaveProperty('request');
        expect(instruction).toHaveProperty('expectedResponseFormat');

        expect(typeof instruction.expertReviewerName).toBe('string');
        expect(Array.isArray(instruction.supportedFileTypes)).toBe(true);
        expect(typeof instruction.grounding).toBe('string');
        expect(typeof instruction.request).toBe('string');
        expect(typeof instruction.expectedResponseFormat).toBe('object');
      });
    });
  });

  describe('When getConditionalRenderingExpert is called...', () => {
    it('... then conditional rendering expert instructions are returned', () => {
      // @ts-expect-error - Testing private method
      const expert = tool.getConditionalRenderingExpert();
      expect(expert.expertReviewerName).toBe('Conditional Rendering Compatibility Expert');
      expect(expert.supportedFileTypes).toEqual(['HTML']);
      expect(expert.grounding).toContain('Komaci offline static analysis engine');
      expect(expert.request).toContain('lwc:if, lwc:elseif, and lwc:else');
    });
  });

  describe('When getGraphqlWireExpert is called...', () => {
    it('... then GraphQL wire expert instructions are returned', () => {
      // @ts-expect-error - Testing private method
      const expert = tool.getGraphqlWireExpert();
      expect(expert.expertReviewerName).toBe('GraphQL Wire Configuration Expert');
      expect(expert.supportedFileTypes).toEqual(['JS']);
      expect(expert.grounding).toContain('GraphQL queries');
      expect(expert.request).toContain('@wire decorators');
    });
  });

  describe('When exec encounters an error...', () => {
    let result: CallToolResult;
    let originalMethod: typeof tool.getExpertReviewInstructions;

    beforeEach(async () => {
      // Store original method and replace with error-throwing version
      originalMethod = tool.getExpertReviewInstructions;
      tool.getExpertReviewInstructions = () => {
        throw new Error('Test error');
      };

      result = await tool.exec({});
    });

    afterEach(() => {
      // Restore the original method
      tool.getExpertReviewInstructions = originalMethod;
    });

    it('... then an error result is returned', () => {
      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('Failed to generate review instructions');
      expect(result.content[0].text).toContain('Test error');
    });
  });
});
