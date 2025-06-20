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
import Cache from '../../src/shared/cache.js';
import { Toolset } from '../../src/shared/types.js';
import { TOOLSET_REGISTRY } from '../../src/shared/toolset-registry.js';

describe('Cache', () => {
  beforeEach(() => {
    // Reset the singleton instance before each test
    // @ts-expect-error - accessing private static property for testing
    Cache.instance = undefined;
  });

  afterEach(() => {
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

    it('should initialize toolsets map with all registry toolsets disabled', () => {
      const cache = Cache.getInstance();
      const toolsets = cache.get('toolsets');

      expect(toolsets).to.be.instanceOf(Map);
      expect(toolsets.size).to.equal(Object.keys(TOOLSET_REGISTRY).length);

      // Check that all toolsets from registry are initialized as disabled
      Object.keys(TOOLSET_REGISTRY).forEach((toolsetName) => {
        const toolset = toolsets.get(toolsetName);
        expect(toolset).to.exist;
        expect(toolset!.enabled).to.be.false;
        expect(toolset!.tools).to.be.an('array').that.is.empty;
      });
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

    it('should retrieve toolsets correctly', async () => {
      const cache = Cache.getInstance();
      const testToolset: Toolset = { enabled: true, tools: [] };
      const toolsets = cache.get('toolsets');
      toolsets.set('test-toolset', testToolset);

      const result = await Cache.safeGet('toolsets');

      expect(result).to.be.instanceOf(Map);
      expect(result.get('test-toolset')).to.deep.equal(testToolset);
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

    it('should set toolsets correctly', async () => {
      const newToolsets = new Map([
        ['toolset1', { enabled: true, tools: [] }],
        ['toolset2', { enabled: false, tools: [] }],
      ]);

      await Cache.safeSet('toolsets', newToolsets);

      const cache = Cache.getInstance();
      const result = cache.get('toolsets');

      expect(result).to.equal(newToolsets);
      expect(result.get('toolset1')?.enabled).to.be.true;
      expect(result.get('toolset2')?.enabled).to.be.false;
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

    it('should update toolsets atomically', async () => {
      const result = await Cache.safeUpdate('toolsets', (currentToolsets) => {
        const newToolsets = new Map(currentToolsets);
        newToolsets.set('new-toolset', { enabled: true, tools: [] });
        return newToolsets;
      });

      expect(result.has('new-toolset')).to.be.true;
      expect(result.get('new-toolset')?.enabled).to.be.true;

      // Verify the change persisted
      const persistedToolsets = await Cache.safeGet('toolsets');
      expect(persistedToolsets.has('new-toolset')).to.be.true;
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

    it('should handle concurrent toolset operations without corruption', async () => {
      // Create concurrent operations on the toolsets map
      const promises = Array.from({ length: 15 }, (_, index) =>
        Cache.safeUpdate('toolsets', (currentToolsets) => {
          const newToolsets = new Map(currentToolsets);
          newToolsets.set(`concurrent-toolset-${index}`, {
            enabled: index % 2 === 0,
            tools: [],
          });
          return newToolsets;
        })
      );

      await Promise.all(promises);

      const finalToolsets = await Cache.safeGet('toolsets');

      // Should have original toolsets plus the new ones
      expect(finalToolsets.size).to.be.greaterThanOrEqual(15);

      // Check that all concurrent toolsets were added
      for (let i = 0; i < 15; i++) {
        const toolset = finalToolsets.get(`concurrent-toolset-${i}`);
        expect(toolset).to.exist;
        expect(toolset!.enabled).to.equal(i % 2 === 0);
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
      const toolsets = firstInstance.get('toolsets');

      expect(allowedOrgs).to.be.instanceOf(Set);
      expect(toolsets).to.be.instanceOf(Map);
      expect(toolsets.size).to.equal(Object.keys(TOOLSET_REGISTRY).length);
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

    it('should maintain type safety for toolsets', async () => {
      const toolsets = new Map([['test', { enabled: true, tools: [] }]]);
      await Cache.safeSet('toolsets', toolsets);

      const retrieved = await Cache.safeGet('toolsets');
      expect(retrieved).to.be.instanceOf(Map);

      const testToolset = retrieved.get('test');
      expect(testToolset).to.exist;
      expect(typeof testToolset!.enabled).to.equal('boolean');
      expect(Array.isArray(testToolset!.tools)).to.be.true;
    });
  });
});
