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
import Cache from '../../src/utils/cache.js';
import { ToolInfo } from '../../src/utils/types.js';

describe('Cache', () => {
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

  describe('Singleton Pattern', () => {
    it('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = Cache.getInstance();
      const instance2 = Cache.getInstance();
      const instance3 = Cache.getInstance();

      expect(instance1).to.equal(instance2);
      expect(instance2).to.equal(instance3);
    });

    it('should handle concurrent getInstance calls safely', async () => {
      // Create multiple concurrent calls to getInstance
      const instances = Array.from({ length: 10 }, () => Cache.getInstance());

      // All instances should be the same object
      const firstInstance = instances[0];
      instances.forEach((instance) => {
        expect(instance).to.equal(firstInstance);
      });
    });
  });

  describe('Initialization', () => {
    it('should initialize with empty allowedOrgs set', () => {
      const cache = Cache.getInstance();
      const allowedOrgs = cache.get('allowedOrgs');

      expect(allowedOrgs).to.be.instanceOf(Set);
      expect(allowedOrgs.size).to.equal(0);
    });

    it('should initialize with empty tools array', () => {
      const cache = Cache.getInstance();
      const tools = cache.get('tools');

      expect(tools).to.be.an('array');
      expect(tools).to.have.length(0);
    });
  });

  describe('safeGet', () => {
    it('should retrieve allowedOrgs correctly', async () => {
      const cache = Cache.getInstance();
      cache.set('allowedOrgs', new Set(['org1', 'org2']));

      const result = await Cache.safeGet('allowedOrgs');

      expect(result).to.be.instanceOf(Set);
      expect(result.has('org1')).to.be.true;
      expect(result.has('org2')).to.be.true;
    });

    it('should retrieve tools correctly', async () => {
      const cache = Cache.getInstance();
      const mockTool = {
        name: 'test-tool',
        enable: sandbox.stub(),
        disable: sandbox.stub(),
        enabled: false,
      } as unknown as RegisteredTool;

      const testToolInfo: ToolInfo = {
        tool: mockTool,
        name: 'test-tool',
      };

      cache.set('tools', [testToolInfo]);

      const result = await Cache.safeGet('tools');

      expect(result).to.be.an('array');
      expect(result).to.have.length(1);
      expect(result[0].name).to.equal('test-tool');
      expect(result[0].tool).to.equal(mockTool);
    });
  });

  describe('safeSet', () => {
    it('should set allowedOrgs correctly', async () => {
      const newOrgs = new Set(['org3', 'org4']);
      await Cache.safeSet('allowedOrgs', newOrgs);

      const cache = Cache.getInstance();
      const result = cache.get('allowedOrgs');

      expect(result).to.equal(newOrgs);
      expect(result.has('org3')).to.be.true;
      expect(result.has('org4')).to.be.true;
    });

    it('should set tools correctly', async () => {
      const mockTool1 = {
        name: 'tool1',
        enable: sandbox.stub(),
        disable: sandbox.stub(),
        enabled: false,
      } as unknown as RegisteredTool;

      const mockTool2 = {
        name: 'tool2',
        enable: sandbox.stub(),
        disable: sandbox.stub(),
        enabled: true,
      } as unknown as RegisteredTool;

      const newTools: ToolInfo[] = [
        { tool: mockTool1, name: 'tool1' },
        { tool: mockTool2, name: 'tool2' },
      ];

      await Cache.safeSet('tools', newTools);

      const cache = Cache.getInstance();
      const result = cache.get('tools');

      expect(result).to.equal(newTools);
      expect(result).to.have.length(2);
      expect(result[0].name).to.equal('tool1');
      expect(result[1].name).to.equal('tool2');
    });
  });

  describe('safeUpdate', () => {
    it('should update allowedOrgs atomically', async () => {
      // Initialize with some orgs
      await Cache.safeSet('allowedOrgs', new Set(['org1', 'org2']));

      // Update by adding a new org
      const result = await Cache.safeUpdate('allowedOrgs', (currentOrgs) => {
        const newOrgs = new Set(currentOrgs);
        newOrgs.add('org3');
        return newOrgs;
      });

      expect(result.has('org1')).to.be.true;
      expect(result.has('org2')).to.be.true;
      expect(result.has('org3')).to.be.true;
      expect(result.size).to.equal(3);

      // Verify the change persisted
      const persistedOrgs = await Cache.safeGet('allowedOrgs');
      expect(persistedOrgs).to.deep.equal(result);
    });

    it('should update tools atomically', async () => {
      const mockTool = {
        name: 'new-tool',
        enable: sandbox.stub(),
        disable: sandbox.stub(),
        enabled: false,
      } as unknown as RegisteredTool;

      const result = await Cache.safeUpdate('tools', (currentTools) => [
        ...currentTools,
        { tool: mockTool, name: 'new-tool' },
      ]);

      expect(result).to.have.length(1);
      expect(result[0].name).to.equal('new-tool');
      expect(result[0].tool).to.equal(mockTool);

      // Verify the change persisted
      const persistedTools = await Cache.safeGet('tools');
      expect(persistedTools).to.have.length(1);
      expect(persistedTools[0].name).to.equal('new-tool');
    });

    it('should return the updated value', async () => {
      const result = await Cache.safeUpdate('allowedOrgs', (currentOrgs) => {
        const newOrgs = new Set(currentOrgs);
        newOrgs.add('test-org');
        return newOrgs;
      });

      expect(result.has('test-org')).to.be.true;
    });
  });

  describe('Thread Safety', () => {
    it('should handle concurrent safeGet operations', async () => {
      // Set up test data
      await Cache.safeSet('allowedOrgs', new Set(['org1', 'org2', 'org3']));

      // Create multiple concurrent read operations
      const promises = Array.from({ length: 20 }, () => Cache.safeGet('allowedOrgs'));
      const results = await Promise.all(promises);

      // All results should be identical
      const firstResult = results[0];
      results.forEach((result) => {
        expect(result).to.deep.equal(firstResult);
        expect(result.size).to.equal(3);
        expect(result.has('org1')).to.be.true;
        expect(result.has('org2')).to.be.true;
        expect(result.has('org3')).to.be.true;
      });
    });

    it('should handle concurrent safeSet operations', async () => {
      // Create multiple concurrent write operations
      const promises = Array.from({ length: 10 }, (_, index) =>
        Cache.safeSet('allowedOrgs', new Set([`org-${index}`]))
      );

      await Promise.all(promises);

      // The final state should be one of the sets that was written
      const finalOrgs = await Cache.safeGet('allowedOrgs');
      expect(finalOrgs.size).to.equal(1);

      // Should contain one of the orgs that was set
      const orgValues = Array.from(finalOrgs);
      expect(orgValues[0]).to.match(/^org-\d$/);
    });

    it('should handle concurrent safeUpdate operations without race conditions', async () => {
      // Initialize with empty set
      await Cache.safeSet('allowedOrgs', new Set<string>());

      // Create multiple concurrent update operations that add unique orgs
      const promises = Array.from({ length: 10 }, (_, index) =>
        Cache.safeUpdate('allowedOrgs', (currentOrgs) => {
          const newOrgs = new Set(currentOrgs);
          newOrgs.add(`concurrent-org-${index}`);
          return newOrgs;
        })
      );

      await Promise.all(promises);

      // Final set should contain all 10 orgs (no lost updates)
      const finalOrgs = await Cache.safeGet('allowedOrgs');
      expect(finalOrgs.size).to.equal(10);

      // Check that all expected orgs are present
      for (let i = 0; i < 10; i++) {
        expect(finalOrgs.has(`concurrent-org-${i}`)).to.be.true;
      }
    });

    it('should handle mixed concurrent operations (read/write/update)', async () => {
      // Initialize with some data
      await Cache.safeSet('allowedOrgs', new Set(['initial-org']));

      const operations: Array<Promise<unknown>> = [];

      // Add concurrent reads
      for (let i = 0; i < 5; i++) {
        operations.push(Cache.safeGet('allowedOrgs'));
      }

      // Add concurrent updates
      for (let i = 0; i < 5; i++) {
        operations.push(
          Cache.safeUpdate('allowedOrgs', (currentOrgs) => {
            const newOrgs = new Set(currentOrgs);
            newOrgs.add(`update-org-${i}`);
            return newOrgs;
          })
        );
      }

      // Add concurrent writes
      for (let i = 0; i < 3; i++) {
        operations.push(Cache.safeSet('allowedOrgs', new Set([`write-org-${i}`, 'initial-org'])));
      }

      await Promise.all(operations);

      // Verify the cache is in a consistent state
      const finalOrgs = await Cache.safeGet('allowedOrgs');
      expect(finalOrgs).to.be.instanceOf(Set);
      expect(finalOrgs.size).to.be.greaterThan(0);
    });

    it('should handle concurrent tool operations without corruption', async () => {
      // Create concurrent operations on the tools array
      const promises = Array.from({ length: 15 }, (_, index) =>
        Cache.safeUpdate('tools', (currentTools) => {
          const mockTool = {
            name: `concurrent-tool-${index}`,
            enable: sandbox.stub(),
            disable: sandbox.stub(),
            enabled: index % 2 === 0,
          } as unknown as RegisteredTool;

          return [...currentTools, { tool: mockTool, name: `concurrent-tool-${index}` }];
        })
      );

      await Promise.all(promises);

      const finalTools = await Cache.safeGet('tools');

      // Should have all 15 tools
      expect(finalTools).to.have.length(15);

      // Check that all concurrent tools were added
      for (let i = 0; i < 15; i++) {
        const tool = finalTools.find((t) => t.name === `concurrent-tool-${i}`);
        expect(tool).to.exist;
        expect(tool!.name).to.equal(`concurrent-tool-${i}`);
      }
    });

    it('should maintain singleton integrity under concurrent access', async () => {
      // Reset instance to test concurrent initialization
      // @ts-expect-error - accessing private static property for testing
      Cache.instance = undefined;

      // Create many concurrent getInstance calls
      const promises = Array.from({ length: 50 }, () => Cache.getInstance());
      const instances = await Promise.all(promises);

      // All instances should be the exact same object
      const firstInstance = instances[0];
      instances.forEach((instance, index) => {
        expect(instance).to.equal(firstInstance, `Instance ${index} should be the same as first instance`);
      });

      // Verify the instance is properly initialized
      const allowedOrgs = firstInstance.get('allowedOrgs');
      const tools = firstInstance.get('tools');

      expect(allowedOrgs).to.be.instanceOf(Set);
      expect(tools).to.be.an('array');
      expect(tools).to.have.length(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in safeUpdate gracefully', async () => {
      await Cache.safeSet('allowedOrgs', new Set(['org1']));

      try {
        await Cache.safeUpdate('allowedOrgs', () => {
          throw new Error('Update function error');
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal('Update function error');
      }

      // Verify the cache state wasn't corrupted
      const orgs = await Cache.safeGet('allowedOrgs');
      expect(orgs.has('org1')).to.be.true;
      expect(orgs.size).to.equal(1);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for allowedOrgs', async () => {
      const orgs = new Set(['org1', 'org2']);
      await Cache.safeSet('allowedOrgs', orgs);

      const retrieved = await Cache.safeGet('allowedOrgs');
      expect(retrieved).to.be.instanceOf(Set);

      // TypeScript should ensure this is a Set<string>
      retrieved.forEach((org) => {
        expect(typeof org).to.equal('string');
      });
    });

    it('should maintain type safety for tools', async () => {
      const mockTool = {
        name: 'test-tool',
        enable: sandbox.stub(),
        disable: sandbox.stub(),
        enabled: false,
      } as unknown as RegisteredTool;

      const tools: ToolInfo[] = [{ tool: mockTool, name: 'test-tool' }];
      await Cache.safeSet('tools', tools);

      const retrieved = await Cache.safeGet('tools');
      expect(retrieved).to.be.an('array');

      const testTool = retrieved[0];
      expect(testTool).to.exist;
      expect(typeof testTool.name).to.equal('string');
      expect(testTool.tool).to.equal(mockTool);
    });
  });
});
