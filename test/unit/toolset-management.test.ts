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

import { expect } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import * as sinon from 'sinon';
import { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getToolsetNameFromTool,
  isValidToolset,
  getAvailableToolsets,
  getToolsForToolset,
  enableToolset,
  disableToolset,
  addToolToToolset,
  getToolsetStatus,
  listAllToolsets,
} from '../../src/shared/toolset-management.js';
import { Toolset } from '../../src/shared/types.js';
import { TOOLSET_REGISTRY } from '../../src/shared/toolset-registry.js';
import Cache from '../../src/shared/cache.js';

describe('Toolset Management', () => {
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = createSandbox();
    // Reset the singleton instance before each test
    // @ts-expect-error - accessing private static property for testing
    Cache.instance = undefined;
  });

  afterEach(() => {
    sandbox.restore();
    // Clean up singleton instance after each test
    // @ts-expect-error - accessing private static property for testing
    Cache.instance = undefined;
  });

  describe('Registry Functions', () => {
    describe('getToolsetNameFromTool', () => {
      it('should find the correct toolset for a tool', () => {
        // Test with known tools from TOOLSET_REGISTRY
        const result = getToolsetNameFromTool('sf-get-username');
        expect(result).to.equal('core');
      });

      it('should find toolset for dynamic tools', () => {
        const result = getToolsetNameFromTool('sf-enable-toolset');
        expect(result).to.equal('dynamic');
      });

      it('should find toolset for org tools', () => {
        const result = getToolsetNameFromTool('sf-list-all-orgs');
        expect(result).to.equal('orgs');
      });

      it('should return undefined for non-existent tool', () => {
        const result = getToolsetNameFromTool('non-existent-tool');
        expect(result).to.be.undefined;
      });

      it('should return undefined for empty string', () => {
        const result = getToolsetNameFromTool('');
        expect(result).to.be.undefined;
      });
    });

    describe('isValidToolset', () => {
      it('should return true for valid toolsets', () => {
        expect(isValidToolset('core')).to.be.true;
        expect(isValidToolset('dynamic')).to.be.true;
        expect(isValidToolset('orgs')).to.be.true;
        expect(isValidToolset('data')).to.be.true;
        expect(isValidToolset('metadata')).to.be.true;
        expect(isValidToolset('users')).to.be.true;
      });

      it('should return false for invalid toolsets', () => {
        expect(isValidToolset('invalid-toolset')).to.be.false;
        expect(isValidToolset('')).to.be.false;
        expect(isValidToolset('CORE')).to.be.false; // Case sensitive
      });
    });

    describe('getAvailableToolsets', () => {
      it('should return all toolset names from registry', () => {
        const result = getAvailableToolsets();
        const expectedToolsets = Object.keys(TOOLSET_REGISTRY);

        expect(result).to.deep.equal(expectedToolsets);
        expect(result).to.include('core');
        expect(result).to.include('dynamic');
        expect(result).to.include('orgs');
        expect(result).to.include('data');
        expect(result).to.include('metadata');
        expect(result).to.include('users');
      });

      it('should return an array', () => {
        const result = getAvailableToolsets();
        expect(Array.isArray(result)).to.be.true;
      });
    });

    describe('getToolsForToolset', () => {
      it('should return tools for valid toolsets', () => {
        const coreTools = getToolsForToolset('core');
        expect(coreTools).to.include('sf-get-username');

        const dynamicTools = getToolsForToolset('dynamic');
        expect(dynamicTools).to.include('sf-get-toolset-tools');
        expect(dynamicTools).to.include('sf-enable-toolset');
        expect(dynamicTools).to.include('sf-list-available-toolsets');
      });

      it('should return empty array for invalid toolset', () => {
        const result = getToolsForToolset('invalid-toolset');
        expect(result).to.deep.equal([]);
      });

      it('should return empty array for empty string', () => {
        const result = getToolsForToolset('');
        expect(result).to.deep.equal([]);
      });
    });
  });

  describe('Cache Operations', () => {
    let mockTool: RegisteredTool;

    beforeEach(() => {
      // Create a mock RegisteredTool
      mockTool = {
        enable: sandbox.stub(),
        disable: sandbox.stub(),
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: {},
        handler: sandbox.stub(),
      } as unknown as RegisteredTool;
    });

    describe('enableToolset', () => {
      it('should enable a disabled toolset', async () => {
        // Initialize cache and add a tool to the toolset
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        toolsetsMap.set('test-toolset', {
          enabled: false,
          tools: [{ tool: mockTool, name: 'test-tool' }],
        });

        const result = await enableToolset('test-toolset');

        expect(result.success).to.be.true;
        expect(result.message).to.equal('Toolset test-toolset enabled');
        expect((mockTool.enable as sinon.SinonStub).callCount).to.equal(1);

        // Verify the toolset is now enabled
        const updatedToolsetsMap = cache.get('toolsets');
        const toolset = updatedToolsetsMap.get('test-toolset');
        expect(toolset?.enabled).to.be.true;
      });

      it('should return success false for already enabled toolset', async () => {
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        toolsetsMap.set('test-toolset', {
          enabled: true,
          tools: [{ tool: mockTool, name: 'test-tool' }],
        });

        const result = await enableToolset('test-toolset');

        expect(result.success).to.be.false;
        expect(result.message).to.equal('Toolset test-toolset is already enabled');
        expect((mockTool.enable as sinon.SinonStub).callCount).to.equal(0);
      });

      it('should return success false for non-existent toolset', async () => {
        const result = await enableToolset('non-existent-toolset');

        expect(result.success).to.be.false;
        expect(result.message).to.equal('Toolset non-existent-toolset not found');
      });

      it('should enable all tools in the toolset', async () => {
        const mockTool2 = {
          enable: sandbox.stub(),
          disable: sandbox.stub(),
        } as unknown as RegisteredTool;

        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        toolsetsMap.set('test-toolset', {
          enabled: false,
          tools: [
            { tool: mockTool, name: 'test-tool-1' },
            { tool: mockTool2, name: 'test-tool-2' },
          ],
        });

        await enableToolset('test-toolset');

        expect((mockTool.enable as sinon.SinonStub).callCount).to.equal(1);
        expect((mockTool2.enable as sinon.SinonStub).callCount).to.equal(1);
      });
    });

    describe('disableToolset', () => {
      it('should disable an enabled toolset', async () => {
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        toolsetsMap.set('test-toolset', {
          enabled: true,
          tools: [{ tool: mockTool, name: 'test-tool' }],
        });

        const result = await disableToolset('test-toolset');

        expect(result.success).to.be.true;
        expect(result.message).to.equal('Toolset test-toolset disabled');
        expect((mockTool.disable as sinon.SinonStub).callCount).to.equal(1);

        // Verify the toolset is now disabled
        const updatedToolsetsMap = cache.get('toolsets');
        const toolset = updatedToolsetsMap.get('test-toolset');
        expect(toolset?.enabled).to.be.false;
      });

      it('should return success false for already disabled toolset', async () => {
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        toolsetsMap.set('test-toolset', {
          enabled: false,
          tools: [{ tool: mockTool, name: 'test-tool' }],
        });

        const result = await disableToolset('test-toolset');

        expect(result.success).to.be.false;
        expect(result.message).to.equal('Toolset test-toolset is already disabled');
        expect((mockTool.disable as sinon.SinonStub).callCount).to.equal(0);
      });

      it('should return success false for non-existent toolset', async () => {
        const result = await disableToolset('non-existent-toolset');

        expect(result.success).to.be.false;
        expect(result.message).to.equal('Toolset non-existent-toolset not found');
      });

      it('should disable all tools in the toolset', async () => {
        const mockTool2 = {
          enable: sandbox.stub(),
          disable: sandbox.stub(),
        } as unknown as RegisteredTool;

        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        toolsetsMap.set('test-toolset', {
          enabled: true,
          tools: [
            { tool: mockTool, name: 'test-tool-1' },
            { tool: mockTool2, name: 'test-tool-2' },
          ],
        });

        await disableToolset('test-toolset');

        expect((mockTool.disable as sinon.SinonStub).callCount).to.equal(1);
        expect((mockTool2.disable as sinon.SinonStub).callCount).to.equal(1);
      });
    });

    describe('addToolToToolset', () => {
      it('should add tool to existing toolset', async () => {
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        toolsetsMap.set('test-toolset', {
          enabled: false,
          tools: [],
        });

        const result = await addToolToToolset('test-toolset', mockTool, 'new-tool');

        expect(result.success).to.be.true;
        expect(result.message).to.equal('Added tool new-tool to toolset test-toolset');

        // Verify the tool was added
        const updatedToolsetsMap = cache.get('toolsets');
        const toolset = updatedToolsetsMap.get('test-toolset');
        expect(toolset?.tools).to.have.length(1);
        expect(toolset?.tools[0].name).to.equal('new-tool');
        expect(toolset?.tools[0].tool).to.equal(mockTool);
      });

      it('should create new toolset if it does not exist', async () => {
        const result = await addToolToToolset('new-toolset', mockTool, 'new-tool');

        expect(result.success).to.be.true;
        expect(result.message).to.equal('Created toolset new-toolset and added tool new-tool');

        // Verify the toolset was created
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        const toolset = toolsetsMap.get('new-toolset');
        expect(toolset).to.exist;
        expect(toolset?.enabled).to.be.false;
        expect(toolset?.tools).to.have.length(1);
        expect(toolset?.tools[0].name).to.equal('new-tool');
      });

      it('should return success false if tool already exists', async () => {
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        toolsetsMap.set('test-toolset', {
          enabled: false,
          tools: [{ tool: mockTool, name: 'existing-tool' }],
        });

        const result = await addToolToToolset('test-toolset', mockTool, 'existing-tool');

        expect(result.success).to.be.false;
        expect(result.message).to.equal('Tool existing-tool already exists in toolset test-toolset');

        // Verify no duplicate was added
        const updatedToolsetsMap = cache.get('toolsets');
        const toolset = updatedToolsetsMap.get('test-toolset');
        expect(toolset?.tools).to.have.length(1);
      });

      it('should preserve toolset enabled state when adding tool', async () => {
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        toolsetsMap.set('enabled-toolset', {
          enabled: true,
          tools: [],
        });

        await addToolToToolset('enabled-toolset', mockTool, 'new-tool');

        const updatedToolsetsMap = cache.get('toolsets');
        const toolset = updatedToolsetsMap.get('enabled-toolset');
        expect(toolset?.enabled).to.be.true;
      });
    });

    describe('getToolsetStatus', () => {
      it('should return toolset status for existing toolset', async () => {
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        toolsetsMap.set('test-toolset', {
          enabled: true,
          tools: [{ tool: mockTool, name: 'test-tool' }],
        });

        const result = await getToolsetStatus('test-toolset');

        expect(result).to.exist;
        expect(result?.enabled).to.be.true;
        expect(result?.tools).to.have.length(1);
        expect(result?.tools[0].name).to.equal('test-tool');
      });

      it('should return undefined for non-existent toolset', async () => {
        const result = await getToolsetStatus('non-existent-toolset');
        expect(result).to.be.undefined;
      });

      it('should return a deep copy to prevent mutations', async () => {
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');
        const originalToolset: Toolset = {
          enabled: true,
          tools: [{ tool: mockTool, name: 'test-tool' }],
        };
        toolsetsMap.set('test-toolset', originalToolset);

        const result = await getToolsetStatus('test-toolset');

        // Modify the returned object
        result!.enabled = false;
        result!.tools[0].name = 'modified-name';

        // Verify original is unchanged
        const unchangedToolset = toolsetsMap.get('test-toolset');
        expect(unchangedToolset?.enabled).to.be.true;
        expect(unchangedToolset?.tools[0].name).to.equal('test-tool');
      });
    });

    describe('listAllToolsets', () => {
      it('should return all toolsets with their status', async () => {
        const cache = Cache.getInstance();
        const toolsetsMap = cache.get('toolsets');

        // Add some test toolsets
        toolsetsMap.set('toolset1', {
          enabled: true,
          tools: [{ tool: mockTool, name: 'tool1' }],
        });
        toolsetsMap.set('toolset2', {
          enabled: false,
          tools: [
            { tool: mockTool, name: 'tool2' },
            { tool: mockTool, name: 'tool3' },
          ],
        });

        const result = await listAllToolsets();

        expect(result).to.be.an('array');
        expect(result.length).to.be.greaterThan(0);

        // Find our test toolsets
        const toolset1 = result.find((t) => t.name === 'toolset1');
        const toolset2 = result.find((t) => t.name === 'toolset2');

        expect(toolset1).to.exist;
        expect(toolset1?.enabled).to.be.true;
        expect(toolset1?.toolCount).to.equal(1);

        expect(toolset2).to.exist;
        expect(toolset2?.enabled).to.be.false;
        expect(toolset2?.toolCount).to.equal(2);
      });

      it('should include all registry toolsets', async () => {
        const result = await listAllToolsets();

        // Should include all toolsets from TOOLSET_REGISTRY
        const toolsetNames = result.map((t) => t.name);
        Object.keys(TOOLSET_REGISTRY).forEach((registryToolset) => {
          expect(toolsetNames).to.include(registryToolset);
        });
      });

      it('should return empty array if no toolsets exist', async () => {
        // Clear all toolsets
        await Cache.safeSet('toolsets', new Map());

        const result = await listAllToolsets();
        expect(result).to.be.an('array');
        expect(result).to.have.length(0);
      });
    });
  });

  describe('Thread Safety', () => {
    let mockTools: RegisteredTool[];

    beforeEach(() => {
      mockTools = Array.from({ length: 5 }, (_, i) => ({
        enable: sandbox.stub(),
        disable: sandbox.stub(),
        name: `tool-${i}`,
        description: `Test tool ${i}`,
        inputSchema: {},
        handler: sandbox.stub(),
      })) as unknown as RegisteredTool[];
    });

    it('should handle concurrent enableToolset operations', async () => {
      // Set up multiple toolsets
      const cache = Cache.getInstance();
      const toolsetsMap = cache.get('toolsets');

      for (let i = 0; i < 5; i++) {
        toolsetsMap.set(`toolset-${i}`, {
          enabled: false,
          tools: [{ tool: mockTools[i], name: `tool-${i}` }],
        });
      }

      // Enable all toolsets concurrently
      const promises = Array.from({ length: 5 }, (_, i) => enableToolset(`toolset-${i}`));

      const results = await Promise.all(promises);

      // All operations should succeed
      results.forEach((result, i) => {
        expect(result.success).to.be.true;
        expect(result.message).to.equal(`Toolset toolset-${i} enabled`);
      });

      // All tools should be enabled
      mockTools.forEach((tool) => {
        expect((tool.enable as sinon.SinonStub).callCount).to.equal(1);
      });
    });

    it('should handle concurrent addToolToToolset operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        addToolToToolset('concurrent-toolset', mockTools[i % 5], `concurrent-tool-${i}`)
      );

      const results = await Promise.all(promises);

      // All operations should succeed
      results.forEach((result) => {
        expect(result.success).to.be.true;
      });

      // At least one should create the toolset, others should add tools
      const createMessages = results.filter((r) => r.message.includes('Created toolset'));
      const addMessages = results.filter((r) => r.message.includes('Added tool'));

      expect(createMessages.length).to.be.greaterThan(0);
      // With synchronous cache, we might get different behavior, so just ensure we have results
      expect(createMessages.length + addMessages.length).to.equal(10);

      // Verify all tools were added
      const toolset = await getToolsetStatus('concurrent-toolset');
      expect(toolset?.tools).to.have.length(10);
    });

    it('should handle mixed concurrent operations', async () => {
      // Set up initial toolsets
      const cache = Cache.getInstance();
      const toolsetsMap = cache.get('toolsets');
      toolsetsMap.set('mixed-toolset', {
        enabled: false,
        tools: [{ tool: mockTools[0], name: 'initial-tool' }],
      });

      const operations: Array<Promise<unknown>> = [];

      // Add concurrent enable/disable operations
      operations.push(enableToolset('mixed-toolset'));
      operations.push(disableToolset('mixed-toolset'));

      // Add concurrent tool additions
      for (let i = 1; i < 5; i++) {
        operations.push(addToolToToolset('mixed-toolset', mockTools[i], `tool-${i}`));
      }

      // Add concurrent status checks
      for (let i = 0; i < 3; i++) {
        operations.push(getToolsetStatus('mixed-toolset'));
      }

      await Promise.all(operations);

      // Verify final state is consistent
      const finalStatus = await getToolsetStatus('mixed-toolset');
      expect(finalStatus).to.exist;
      expect(finalStatus?.tools.length).to.be.greaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid toolset names gracefully', async () => {
      const enableResult = await enableToolset('');
      expect(enableResult.success).to.be.false;

      const disableResult = await disableToolset('');
      expect(disableResult.success).to.be.false;

      const statusResult = await getToolsetStatus('');
      expect(statusResult).to.be.undefined;
    });

    it('should handle null/undefined tool names', async () => {
      const mockTool = { enable: sandbox.stub() } as unknown as RegisteredTool;

      const result = await addToolToToolset('test-toolset', mockTool, '');
      // Should still work with empty string name
      expect(result.success).to.be.true;
    });
  });
});
