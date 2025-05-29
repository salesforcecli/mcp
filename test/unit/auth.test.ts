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
import { ConfigAggregator, ConfigInfo, OrgConfigProperties } from '@salesforce/core';
import { getDefaultTargetOrg, getDefaultTargetDevHub } from '../../src/shared/auth.js';

describe('auth tests', () => {
  const sandbox = sinon.createSandbox();
  let configAggregatorCreateStub: sinon.SinonStub;
  let configAggregatorGetInfoStub: sinon.SinonStub;

  beforeEach(() => {
    // Reset ConfigAggregator instance before each test
    // @ts-expect-error Accessing private static instance to reset singleton
    ConfigAggregator.instance = undefined;

    // Stub ConfigAggregator.create
    configAggregatorCreateStub = sandbox.stub(ConfigAggregator, 'create');
    configAggregatorGetInfoStub = sandbox.stub();

    // Mock the ConfigAggregator instance
    const mockAggregator = {
      getInfo: configAggregatorGetInfoStub,
    };
    configAggregatorCreateStub.resolves(mockAggregator);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('getDefaultTargetOrg', () => {
    it('should return target org config when it exists', async () => {
      const mockConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path',
        isLocal: () => true,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.returns(mockConfig);

      const result = await getDefaultTargetOrg();

      expect(result).to.deep.equal(mockConfig);
      expect(configAggregatorCreateStub.calledOnce).to.be.true;
      expect(configAggregatorGetInfoStub.calledWith(OrgConfigProperties.TARGET_ORG)).to.be.true;
    });

    it('should return undefined when target org config has no value', async () => {
      const mockConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: undefined,
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path',
        isLocal: () => true,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.returns(mockConfig);

      const result = await getDefaultTargetOrg();

      expect(result).to.be.undefined;
      expect(configAggregatorCreateStub.calledOnce).to.be.true;
    });

    it('should return undefined when target org config does not exist', async () => {
      // Return a config object with no value/path instead of undefined to avoid destructuring error
      const mockConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: undefined,
        location: undefined,
        path: undefined,
        isLocal: () => false,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.returns(mockConfig);

      const result = await getDefaultTargetOrg();

      expect(result).to.be.undefined;
      expect(configAggregatorCreateStub.calledOnce).to.be.true;
    });

    it('should use cache on subsequent calls from the same directory', async () => {
      const mockConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/cache1',
        isLocal: () => true,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.returns(mockConfig);

      // First call
      const result1 = await getDefaultTargetOrg();
      expect(result1).to.deep.equal(mockConfig);
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call should use cache based on path
      const result2 = await getDefaultTargetOrg();
      expect(result2).to.deep.equal({ ...mockConfig, cached: true });
      expect(configAggregatorCreateStub.calledTwice).to.be.true; // ConfigAggregator is called every time to get the path.
    });

    it('should not use cache when config path changes', async () => {
      const mockConfig1: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org1@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path1',
        isLocal: () => true,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      const mockConfig2: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org2@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path2',
        isLocal: () => true,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      // First call with first config path
      configAggregatorGetInfoStub.returns(mockConfig1);
      const result1 = await getDefaultTargetOrg();
      expect(result1).to.deep.equal(mockConfig1);
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call with different config path should not use cache
      configAggregatorGetInfoStub.returns(mockConfig2);
      const result2 = await getDefaultTargetOrg();
      expect(result2).to.deep.equal(mockConfig2); // The cache: true is not there
      expect(configAggregatorCreateStub.calledTwice).to.be.true;
    });

    it('should use cache when same config path is returned (ignores new value)', async () => {
      const mockConfig1: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/cache2',
        isLocal: () => true,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      const mockConfig2: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: 'CHANGED_VALUE@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/cache2',
        isLocal: () => true,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      // First call - should cache the config by path
      configAggregatorGetInfoStub.returns(mockConfig1);
      const result1 = await getDefaultTargetOrg();
      expect(result1).to.deep.equal(mockConfig1);
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call with same path should use cache
      configAggregatorGetInfoStub.returns(mockConfig2);
      const result2 = await getDefaultTargetOrg();
      expect(result2).to.deep.equal({ ...mockConfig1, cached: true });
      expect(configAggregatorCreateStub.calledTwice).to.be.true; // ConfigAggregator is called every time to get the path.
    });
  });

  describe('getDefaultTargetDevHub', () => {
    it('should return target dev hub config when it exists', async () => {
      const mockConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path',
        isLocal: () => false,
        isGlobal: () => true,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.returns(mockConfig);

      const result = await getDefaultTargetDevHub();

      expect(result).to.deep.equal(mockConfig);
      expect(configAggregatorCreateStub.calledOnce).to.be.true;
      expect(configAggregatorGetInfoStub.calledWith(OrgConfigProperties.TARGET_DEV_HUB)).to.be.true;
    });

    it('should return undefined when target dev hub config has no value', async () => {
      const mockConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: null,
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path',
        isLocal: () => false,
        isGlobal: () => true,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.returns(mockConfig);

      const result = await getDefaultTargetDevHub();

      expect(result).to.be.undefined;
      expect(configAggregatorCreateStub.calledOnce).to.be.true;
    });

    it('should return undefined when target dev hub config does not exist', async () => {
      const mockConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: undefined,
        location: undefined,
        path: undefined,
        isLocal: () => false,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.returns(mockConfig);

      const result = await getDefaultTargetDevHub();

      expect(result).to.be.undefined;
      expect(configAggregatorCreateStub.calledOnce).to.be.true;
    });

    it('should use cache on subsequent calls from the same directory', async () => {
      const mockConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/cache1',
        isLocal: () => false,
        isGlobal: () => true,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.returns(mockConfig);

      // First call
      const result1 = await getDefaultTargetDevHub();
      expect(result1).to.deep.equal(mockConfig);
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call should use cache based on path
      const result2 = await getDefaultTargetDevHub();
      expect(result2).to.deep.equal({ ...mockConfig, cached: true });
      expect(configAggregatorCreateStub.calledTwice).to.be.true; // ConfigAggregator is called every time to get the path.
    });

    it('should not use cache when config path changes', async () => {
      const mockConfig1: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub1@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path1',
        isLocal: () => false,
        isGlobal: () => true,
        isEnvVar: () => false,
      };

      const mockConfig2: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub2@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path2',
        isLocal: () => false,
        isGlobal: () => true,
        isEnvVar: () => false,
      };

      // First call with first config path
      configAggregatorGetInfoStub.returns(mockConfig1);
      const result1 = await getDefaultTargetDevHub();
      expect(result1).to.deep.equal(mockConfig1);
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call with different config path should not use cache
      configAggregatorGetInfoStub.returns(mockConfig2);
      const result2 = await getDefaultTargetDevHub();
      expect(result2).to.deep.equal(mockConfig2);
      expect(configAggregatorCreateStub.calledTwice).to.be.true;
    });

    it('should use cache when same config path is returned (ignores new value)', async () => {
      const mockConfig1: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/cache2',
        isLocal: () => false,
        isGlobal: () => true,
        isEnvVar: () => false,
      };

      const mockConfig2: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'CHANGED_DEVHUB@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/cache2',
        isLocal: () => false,
        isGlobal: () => true,
        isEnvVar: () => false,
      };

      // First call - should cache the config by path
      configAggregatorGetInfoStub.returns(mockConfig1);
      const result1 = await getDefaultTargetDevHub();
      expect(result1).to.deep.equal(mockConfig1);
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call with same path should use (returns mockConfig2, but resolves to mockConfig1)
      configAggregatorGetInfoStub.returns(mockConfig2);
      const result2 = await getDefaultTargetDevHub();
      expect(result2).to.deep.equal({ ...mockConfig1, cached: true });
      expect(configAggregatorCreateStub.calledTwice).to.be.true; // ConfigAggregator is called every time to get the path.
    });
  });

  describe('cache isolation between target org and dev hub', () => {
    it('should maintain separate caches for target org and dev hub', async () => {
      const mockTargetOrgConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: 'target-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/isolation1',
        isLocal: () => true,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      const mockDevHubConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/isolation1',
        isLocal: () => false,
        isGlobal: () => true,
        isEnvVar: () => false,
      };

      // Set up different responses for different properties
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(mockTargetOrgConfig);
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(mockDevHubConfig);

      // First calls
      const targetOrgResult1 = await getDefaultTargetOrg();
      const devHubResult1 = await getDefaultTargetDevHub();

      expect(targetOrgResult1).to.deep.equal(mockTargetOrgConfig);
      expect(devHubResult1).to.deep.equal(mockDevHubConfig);
      expect(configAggregatorCreateStub.calledTwice).to.be.true;

      // Second calls should use cache for both
      const targetOrgResult2 = await getDefaultTargetOrg();
      const devHubResult2 = await getDefaultTargetDevHub();

      expect(targetOrgResult2).to.deep.equal({ ...mockTargetOrgConfig, cached: true });
      expect(devHubResult2).to.deep.equal({ ...mockDevHubConfig, cached: true });
      expect(configAggregatorCreateStub.callCount).to.equal(4); // Called twice for each function (4 total)
    });
  });
});
