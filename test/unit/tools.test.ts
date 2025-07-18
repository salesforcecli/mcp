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
import sinon from 'sinon';
import { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { addTool, enableTool, disableTool, getToolStatus, listAllTools, CORE_TOOLS } from '../../src/shared/tools.js';
import Cache from '../../src/shared/cache.js';

describe('Tool Management', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
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

  describe('Core Tools', () => {
    it('should have defined core tools', () => {
      expect(CORE_TOOLS).to.be.an('array');
      expect(CORE_TOOLS).to.include('sf-get-username');
      expect(CORE_TOOLS).to.include('sf-enable-tool');
      expect(CORE_TOOLS).to.include('sf-resume');
      expect(CORE_TOOLS).to.include('sf-list-tools');
    });
  });

  describe('Tool Operations', () => {
    let mockTool: RegisteredTool & { enabled: boolean };

    beforeEach(() => {
      // Create a mock RegisteredTool with enabled property
      mockTool = {
        enable: sandbox.stub().callsFake(() => {
          mockTool.enabled = true;
        }),
        disable: sandbox.stub().callsFake(() => {
          mockTool.enabled = false;
        }),
        name: 'test-tool',
        description: 'Test tool description',
        inputSchema: {},
        handler: sandbox.stub(),
        enabled: false, // Start disabled by default
        callback: sandbox.stub(),
        update: sandbox.stub(),
        remove: sandbox.stub(),
      } as unknown as RegisteredTool & { enabled: boolean };
    });

    describe('addTool', () => {
      it('should add a new tool to the cache', async () => {
        const result = await addTool(mockTool, 'test-tool');

        expect(result.success).to.be.true;
        expect(result.message).to.equal('Added tool test-tool');

        // Verify the tool was added to cache
        const cache = Cache.getInstance();
        const tools = cache.get('tools');
        expect(tools).to.have.length(1);
        expect(tools[0].name).to.equal('test-tool');
        expect(tools[0].tool).to.equal(mockTool);
      });

      it('should return error if tool already exists', async () => {
        // Add tool first time
        await addTool(mockTool, 'test-tool');

        // Try to add same tool again
        const result = await addTool(mockTool, 'test-tool');

        expect(result.success).to.be.false;
        expect(result.message).to.equal('Tool test-tool already exists');
      });
    });

    describe('enableTool', () => {
      beforeEach(async () => {
        // Add a tool to work with (tools start disabled by default)
        await addTool(mockTool, 'test-tool');
      });

      it('should enable a disabled tool', async () => {
        const result = await enableTool('test-tool');

        expect(result.success).to.be.true;
        expect(result.message).to.equal('Tool test-tool enabled');
        expect((mockTool.enable as sinon.SinonStub).callCount).to.equal(1);
      });

      it('should return error for already enabled tool', async () => {
        // Enable tool first
        await enableTool('test-tool');

        // Try to enable again
        const result = await enableTool('test-tool');

        expect(result.success).to.be.false;
        expect(result.message).to.equal('Tool test-tool is already enabled');
      });

      it('should return error for non-existent tool', async () => {
        const result = await enableTool('non-existent-tool');

        expect(result.success).to.be.false;
        expect(result.message).to.equal('Tool non-existent-tool not found');
      });
    });

    describe('disableTool', () => {
      beforeEach(async () => {
        // Add and enable a tool to work with
        await addTool(mockTool, 'test-tool');
        // Set the tool as enabled
        mockTool.enabled = true;
      });

      it('should disable an enabled tool', async () => {
        const result = await disableTool('test-tool');

        expect(result.success).to.be.true;
        expect(result.message).to.equal('Tool test-tool disabled');
        expect((mockTool.disable as sinon.SinonStub).callCount).to.equal(1);
      });

      it('should return error for already disabled tool', async () => {
        // Set tool as disabled
        mockTool.enabled = false;

        const result = await disableTool('test-tool');

        expect(result.success).to.be.false;
        expect(result.message).to.equal('Tool test-tool is already disabled');
      });

      it('should return error for non-existent tool', async () => {
        const result = await disableTool('non-existent-tool');

        expect(result.success).to.be.false;
        expect(result.message).to.equal('Tool non-existent-tool not found');
      });
    });

    describe('getToolStatus', () => {
      beforeEach(async () => {
        // Add a tool to work with
        await addTool(mockTool, 'test-tool');
      });

      it('should return tool status for existing tool', async () => {
        const result = await getToolStatus('test-tool');

        expect(result).to.not.be.undefined;
        expect(result?.enabled).to.equal(mockTool.enabled);
        expect(result?.description).to.equal('Test tool description');
      });

      it('should return undefined for non-existent tool', async () => {
        const result = await getToolStatus('non-existent-tool');
        expect(result).to.be.undefined;
      });

      it('should reflect enabled state correctly', async () => {
        // Set tool as enabled
        mockTool.enabled = true;

        const result = await getToolStatus('test-tool');
        expect(result?.enabled).to.be.true;
      });
    });

    describe('listAllTools', () => {
      it('should return empty array when no tools exist', async () => {
        const result = await listAllTools();
        expect(result).to.be.an('array').that.is.empty;
      });

      it('should return all tools with their status', async () => {
        // Add multiple tools
        const mockTool2 = {
          ...mockTool,
          name: 'test-tool-2',
          description: 'Second test tool',
          enabled: true,
        } as unknown as RegisteredTool & { enabled: boolean };
        await addTool(mockTool, 'test-tool-1');
        await addTool(mockTool2, 'test-tool-2');

        const result = await listAllTools();

        expect(result).to.have.length(2);

        const tool1 = result.find((t) => t.name === 'test-tool-1');
        expect(tool1).to.not.be.undefined;
        expect(tool1?.enabled).to.equal(mockTool.enabled);
        expect(tool1?.description).to.equal('Test tool description');

        const tool2 = result.find((t) => t.name === 'test-tool-2');
        expect(tool2).to.not.be.undefined;
        expect(tool2?.enabled).to.be.true;
        expect(tool2?.description).to.equal('Second test tool');
      });
    });
  });

  describe('Thread Safety', () => {
    let mockTool: RegisteredTool & { enabled: boolean };

    beforeEach(() => {
      mockTool = {
        enable: sandbox.stub().callsFake(() => {
          mockTool.enabled = true;
        }),
        disable: sandbox.stub().callsFake(() => {
          mockTool.enabled = false;
        }),
        name: 'test-tool',
        description: 'Test tool',
        inputSchema: {},
        handler: sandbox.stub(),
        enabled: false,
        callback: sandbox.stub(),
        update: sandbox.stub(),
        remove: sandbox.stub(),
      } as unknown as RegisteredTool & { enabled: boolean };
    });

    it('should handle concurrent tool additions', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        const tool = { ...mockTool, name: `test-tool-${i}` } as unknown as RegisteredTool & { enabled: boolean };
        promises.push(addTool(tool, `test-tool-${i}`));
      }

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).to.be.true;
      });

      // Verify all tools were added
      const cache = Cache.getInstance();
      const tools = cache.get('tools');
      expect(tools).to.have.length(10);
    });

    it('should handle concurrent enable/disable operations', async () => {
      // Add tools first
      const toolPromises = [];
      for (let i = 0; i < 5; i++) {
        const tool = { ...mockTool, name: `test-tool-${i}` } as unknown as RegisteredTool & { enabled: boolean };
        toolPromises.push(addTool(tool, `test-tool-${i}`));
      }
      await Promise.all(toolPromises);

      // Concurrent enable/disable operations
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(enableTool(`test-tool-${i}`));
        promises.push(disableTool(`test-tool-${i}`)); // This should fail since tool starts disabled
      }

      const results = await Promise.all(promises);

      // Enable operations should succeed, disable operations should fail
      const enableResults = results.filter((_, index) => index % 2 === 0);
      const disableResults = results.filter((_, index) => index % 2 === 1);

      enableResults.forEach((result) => {
        expect(result.success).to.be.true;
      });

      disableResults.forEach((result) => {
        expect(result.success).to.be.false;
        expect(result.message).to.include('is already disabled');
      });
    });
  });
});
