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
import { NativeCapabilityTool } from '../../src/tools/native-capabilities/create_mobile_lwc_native_capabilities.js';
import { AppReviewConfig } from '../../src/tools/native-capabilities/nativeCapabilityConfig.js';
import { TextOutputSchema } from '../../src/schemas/lwcSchema.js';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

describe('Tests for NativeCapabilityTool', () => {
  let tool: NativeCapabilityTool;

  beforeEach(() => {
    tool = new NativeCapabilityTool(AppReviewConfig);
  });

  it("When getReleaseState is called, then 'non-ga' is returned", () => {
    expect(tool.getReleaseState()).toEqual(ReleaseState.NON_GA);
  });

  it("When getToolsets is called, then 'mobile' is returned", () => {
    expect(tool.getToolsets()).toEqual([Toolset.MOBILE]);
  });

  it('When getName is called, then the toolId is returned', () => {
    expect(tool.getName()).toEqual(AppReviewConfig.toolId);
  });

  it('When getConfig is called, then the correct configuration is returned', () => {
    const config: McpToolConfig = tool.getConfig();
    expect(config.title).toEqual(AppReviewConfig.title);
    expect(config.description).toEqual(AppReviewConfig.description);
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
      expect(result.structuredContent).toHaveProperty('content');
      expect(typeof (result.structuredContent as z.infer<typeof TextOutputSchema>).content).toBe('string');
    });
  });

  describe('When exec encounters a file reading error...', () => {
    let result: CallToolResult;
    let originalReadTypeDefinitionFile: () => Promise<string>;

    beforeEach(async () => {
      // Store original method and replace with error-throwing version
      // @ts-expect-error - Testing private method
      originalReadTypeDefinitionFile = tool.readTypeDefinitionFile;
      // @ts-expect-error - Testing private method
      tool.readTypeDefinitionFile = async () => {
        throw new Error('File not found');
      };

      result = await tool.exec({});
    });

    afterEach(() => {
      // Restore the original method
      // @ts-expect-error - Restoring private method
      tool.readTypeDefinitionFile = originalReadTypeDefinitionFile;
    });

    it('... then an error result is returned', () => {
      expect(result).toHaveProperty('isError', true);
      expect(result).toHaveProperty('content');
      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toHaveProperty('type', 'text');
      expect(result.content[0].text).toContain('Error: Unable to load');
      expect(result.content[0].text).toContain(AppReviewConfig.toolId);
      expect(result.content[0].text).toContain('type definitions');
    });

    it('... then structured content with error is returned', () => {
      expect(result).toHaveProperty('structuredContent');
      expect(result.structuredContent).toBeDefined();
      expect(result.structuredContent).toHaveProperty('content');
      expect((result.structuredContent as z.infer<typeof TextOutputSchema>).content).toContain('Error: Unable to load');
    });
  });
});
