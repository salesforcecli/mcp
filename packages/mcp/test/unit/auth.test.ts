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
import { AuthInfo, ConfigAggregator, ConfigInfo, OrgConfigProperties, type OrgAuthorization } from '@salesforce/core';
import { type SanitizedOrgAuthorization } from '@salesforce/mcp-provider-api';
import {
  getAllAllowedOrgs,
  getDefaultTargetOrg,
  getDefaultTargetDevHub,
  sanitizeOrgs,
  findOrgByUsernameOrAlias,
  filterAllowedOrgs,
} from '../../src/utils/auth.js';
import Cache from '../../src/utils/cache.js';

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

  describe('sanitizeOrgs', () => {
    it('should return only allowed fields and filter out sensitive data', () => {
      const mockRawOrgs: OrgAuthorization[] = [
        {
          username: 'test-org@example.com',
          aliases: ['test-alias'],
          instanceUrl: 'https://test.salesforce.com',
          isScratchOrg: false,
          isDevHub: true,
          isSandbox: false,
          orgId: '00D000000000000EAA',
          oauthMethod: 'web',
          isExpired: false,
          configs: null,
          accessToken: 'secret-token', // This should be filtered out
        },
      ];

      const result = sanitizeOrgs(mockRawOrgs);

      expect(result).to.have.length(1);
      const sanitizedOrg = result[0];

      // Verify that sensitive fields are not included
      expect(sanitizedOrg).to.not.have.property('accessToken');

      // Verify that allowed fields are present
      expect(sanitizedOrg.username).to.equal('test-org@example.com');
      expect(sanitizedOrg.aliases).to.deep.equal(['test-alias']);
      expect(sanitizedOrg.instanceUrl).to.equal('https://test.salesforce.com');
      expect(sanitizedOrg.isScratchOrg).to.equal(false);
      expect(sanitizedOrg.isDevHub).to.equal(true);
      expect(sanitizedOrg.isSandbox).to.equal(false);
      expect(sanitizedOrg.orgId).to.equal('00D000000000000EAA');
      expect(sanitizedOrg.oauthMethod).to.equal('web');
      expect(sanitizedOrg.isExpired).to.equal(false);

      // Verify only allowed fields are present
      const allowedFields = [
        'aliases',
        'username',
        'instanceUrl',
        'isScratchOrg',
        'isDevHub',
        'isSandbox',
        'orgId',
        'oauthMethod',
        'isExpired',
        'configs',
      ];
      Object.keys(sanitizedOrg).forEach((key) => {
        expect(allowedFields).to.include(key);
      });
    });

    it('should handle null and undefined values gracefully', () => {
      const mockRawOrgs: OrgAuthorization[] = [
        {
          username: 'test-org@example.com',
          aliases: null, // null value should be handled
          instanceUrl: 'https://test.salesforce.com',
          isScratchOrg: false,
          isDevHub: undefined, // undefined value should be handled
          isSandbox: false,
          orgId: '00D000000000000EAA',
          oauthMethod: 'web',
          isExpired: false,
          configs: null,
        },
      ];

      const result = sanitizeOrgs(mockRawOrgs);

      expect(result).to.have.length(1);
      const sanitizedOrg = result[0];

      expect(sanitizedOrg.aliases).to.be.null; // null value is preserved
      expect(sanitizedOrg.isDevHub).to.be.undefined; // undefined value is preserved
      expect(sanitizedOrg.configs).to.be.null; // null value is preserved
      expect(sanitizedOrg.username).to.equal('test-org@example.com');
      expect(sanitizedOrg.instanceUrl).to.equal('https://test.salesforce.com');
      expect(sanitizedOrg.isScratchOrg).to.equal(false);
      expect(sanitizedOrg.isSandbox).to.equal(false);
      expect(sanitizedOrg.orgId).to.equal('00D000000000000EAA');
      expect(sanitizedOrg.oauthMethod).to.equal('web');
      expect(sanitizedOrg.isExpired).to.equal(false);
    });

    it('should handle empty array', () => {
      const result = sanitizeOrgs([]);
      expect(result).to.deep.equal([]);
    });

    it('should handle multiple orgs', () => {
      const mockRawOrgs: OrgAuthorization[] = [
        {
          username: 'org1@example.com',
          aliases: ['org1-alias'],
          instanceUrl: 'https://org1.salesforce.com',
          isScratchOrg: false,
          isDevHub: true,
          isSandbox: false,
          orgId: '00D000000000001EAA',
          oauthMethod: 'web',
          isExpired: false,
          configs: null,
          accessToken: 'secret1', // Should be filtered out
        },
        {
          username: 'org2@example.com',
          aliases: ['org2-alias'],
          instanceUrl: 'https://org2.salesforce.com',
          isScratchOrg: true,
          isDevHub: false,
          isSandbox: true,
          orgId: '00D000000000002EAA',
          oauthMethod: 'jwt',
          isExpired: true,
          configs: null,
        },
      ];

      const result = sanitizeOrgs(mockRawOrgs);

      expect(result).to.have.length(2);

      // Verify first org
      const org1 = result[0];
      expect(org1.username).to.equal('org1@example.com');
      expect(org1.aliases).to.deep.equal(['org1-alias']);
      expect(org1).to.not.have.property('accessToken');

      // Verify second org
      const org2 = result[1];
      expect(org2.username).to.equal('org2@example.com');
      expect(org2.aliases).to.deep.equal(['org2-alias']);
      expect(org2.isScratchOrg).to.equal(true);
      expect(org2.isExpired).to.equal(true);
      expect(org2).to.not.have.property('accessToken');
    });
  });

  describe('findOrgByUsernameOrAlias', () => {
    const mockOrgs: SanitizedOrgAuthorization[] = [
      {
        username: 'org1@example.com',
        aliases: ['org1-alias', 'primary-org'],
        instanceUrl: 'https://org1.salesforce.com',
        isScratchOrg: false,
        isDevHub: true,
        isSandbox: false,
        orgId: '00D000000000001EAA',
        oauthMethod: 'web',
        isExpired: false,
        configs: null,
      },
      {
        username: 'org2@example.com',
        aliases: ['org2-alias'],
        instanceUrl: 'https://org2.salesforce.com',
        isScratchOrg: true,
        isDevHub: false,
        isSandbox: true,
        orgId: '00D000000000002EAA',
        oauthMethod: 'jwt',
        isExpired: false,
        configs: null,
      },
      {
        username: 'org3@example.com',
        aliases: null, // Test null aliases
        instanceUrl: 'https://org3.salesforce.com',
        isScratchOrg: false,
        isDevHub: false,
        isSandbox: false,
        orgId: '00D000000000003EAA',
        oauthMethod: 'web',
        isExpired: true,
        configs: null,
      },
    ];

    it('should find org by exact username match', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'org2@example.com');

      expect(result).to.not.be.undefined;
      expect(result!.username).to.equal('org2@example.com');
    });

    it('should find org by alias match', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'org1-alias');

      expect(result).to.not.be.undefined;
      expect(result!.username).to.equal('org1@example.com');
    });

    // I don't think this is possible, but the types allow it :shrug:
    it('should find org by alias when org has multiple aliases', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'primary-org');

      expect(result).to.not.be.undefined;
      expect(result!.username).to.equal('org1@example.com');
      expect(result!.aliases).to.deep.equal(['org1-alias', 'primary-org']);
    });

    it('should return undefined when username is not found', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'nonexistent@example.com');

      expect(result).to.be.undefined;
    });

    it('should return undefined when searching for alias that does not exist', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'nonexistent-alias');

      expect(result).to.be.undefined;
    });

    it('should handle empty orgs array', () => {
      const result = findOrgByUsernameOrAlias([], 'any@example.com');

      expect(result).to.be.undefined;
    });

    it('should handle org with null aliases', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'org3@example.com');

      expect(result).to.not.be.undefined;
      expect(result!.username).to.equal('org3@example.com');
      expect(result!.aliases).to.be.null;
    });

    // This match the CLI behavior
    it('should be case sensitive for username matching', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'ORG1@EXAMPLE.COM');

      expect(result).to.be.undefined;
    });

    it('should be case sensitive for alias matching', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'ORG1-ALIAS');

      expect(result).to.be.undefined;
    });
  });

  describe('getAllAllowedOrgs', () => {
    let authInfoListStub: sinon.SinonStub;

    beforeEach(() => {
      // Set up mock org data that will be used across all tests
      const mockOrgs = [
        {
          username: 'org1@example.com',
          aliases: ['org1-alias'],
          instanceUrl: 'https://org1.salesforce.com',
          isScratchOrg: false,
          isDevHub: true,
          isSandbox: false,
          orgId: '00D000000000001EAA',
          oauthMethod: 'web' as const,
          isExpired: false,
          configs: null,
        },
        {
          username: 'org2@example.com',
          aliases: ['org2-alias'],
          instanceUrl: 'https://org2.salesforce.com',
          isScratchOrg: false,
          isDevHub: true,
          isSandbox: false,
          orgId: '00D000000000002EAA',
          oauthMethod: 'web' as const,
          isExpired: false,
          configs: null,
        },
      ];

      authInfoListStub = sandbox.stub(AuthInfo, 'listAllAuthorizations');
      authInfoListStub.resolves(mockOrgs);

      // Set up default responses for config queries (empty configs)
      // This reuses the existing configAggregatorGetInfoStub from the main describe block
      const emptyTargetOrgConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: undefined,
        location: undefined,
        path: undefined,
        isLocal: () => false,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      const emptyDevHubConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: undefined,
        location: undefined,
        path: undefined,
        isLocal: () => false,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(emptyTargetOrgConfig);
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(emptyDevHubConfig);
    });

    it('should only return orgs that exists in allowlist', async () => {
      sandbox.stub(Cache, 'safeGet').resolves(new Set(['org1@example.com']));

      const result = await getAllAllowedOrgs();

      expect(authInfoListStub.calledOnce).to.be.true;
      expect(result).to.have.length(1);
      expect(result[0].username).to.equal('org1@example.com');
    });

    it('should return all orgs if ALLOW_ALL_ORGS is set', async () => {
      sandbox.stub(Cache, 'safeGet').resolves(new Set(['ALLOW_ALL_ORGS']));

      const result = await getAllAllowedOrgs();

      expect(authInfoListStub.calledOnce).to.be.true;
      expect(result).to.have.length(2);
      expect(result[0].username).to.equal('org1@example.com');
      expect(result[1].username).to.equal('org2@example.com');
    });

    it('should return an orgs by an alias', async () => {
      sandbox.stub(Cache, 'safeGet').resolves(new Set(['org1-alias']));

      const result = await getAllAllowedOrgs();

      expect(authInfoListStub.calledOnce).to.be.true;
      expect(result).to.have.length(1);
      expect(result[0].username).to.equal('org1@example.com');
    });

    it('should return org matching DEFAULT_TARGET_ORG config', async () => {
      // Reset stub configurations to ensure clean state
      configAggregatorGetInfoStub.resetHistory();
      configAggregatorGetInfoStub.resetBehavior();

      // Stub the config to return org2@example.com as the default target org
      const targetOrgConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: 'org2@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path',
        isLocal: () => true,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      const emptyDevHubConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: undefined,
        location: undefined,
        path: undefined,
        isLocal: () => false,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(targetOrgConfig);
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(emptyDevHubConfig);

      sandbox.stub(Cache, 'safeGet').resolves(new Set(['DEFAULT_TARGET_ORG']));

      const result = await getAllAllowedOrgs();

      expect(authInfoListStub.calledOnce).to.be.true;
      expect(result).to.have.length(1);
      expect(result[0].username).to.equal('org2@example.com');
    });

    it('should return org matching DEFAULT_TARGET_DEV_HUB config', async () => {
      // Reset stub configurations to ensure clean state
      configAggregatorGetInfoStub.resetHistory();
      configAggregatorGetInfoStub.resetBehavior();

      // Stub the config to return org1@example.com as the default dev hub
      const devHubConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'org1@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path',
        isLocal: () => false,
        isGlobal: () => true,
        isEnvVar: () => false,
      };

      const emptyTargetOrgConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: undefined,
        location: undefined,
        path: undefined,
        isLocal: () => false,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(emptyTargetOrgConfig);
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(devHubConfig);

      sandbox.stub(Cache, 'safeGet').resolves(new Set(['DEFAULT_TARGET_DEV_HUB']));

      const result = await getAllAllowedOrgs();

      expect(authInfoListStub.calledOnce).to.be.true;
      expect(result).to.have.length(1);
      expect(result[0].username).to.equal('org1@example.com');
    });
  });

  describe('filterAllowedOrgs', () => {
    const mockOrgs: SanitizedOrgAuthorization[] = [
      {
        username: 'org1@example.com',
        aliases: ['org1-alias'],
        instanceUrl: 'https://org1.salesforce.com',
        isScratchOrg: false,
        isDevHub: true,
        isSandbox: false,
        orgId: '00D000000000001EAA',
        oauthMethod: 'web',
        isExpired: false,
        configs: null,
      },
      {
        username: 'org2@example.com',
        aliases: ['my-alias', 'another-alias'],
        instanceUrl: 'https://org2.salesforce.com',
        isScratchOrg: true,
        isDevHub: false,
        isSandbox: true,
        orgId: '00D000000000002EAA',
        oauthMethod: 'jwt',
        isExpired: false,
        configs: null,
      },
      {
        username: 'org3@example.com',
        aliases: ['org3-alias'],
        instanceUrl: 'https://org3.salesforce.com',
        isScratchOrg: false,
        isDevHub: false,
        isSandbox: false,
        orgId: '00D000000000003EAA',
        oauthMethod: 'web',
        isExpired: false,
        configs: null,
      },
    ];

    beforeEach(() => {
      // Set up default responses for config queries (empty configs)
      // This reuses the existing configAggregatorGetInfoStub from the main describe block
      const emptyConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: undefined,
        location: undefined,
        path: undefined,
        isLocal: () => false,
        isGlobal: () => false,
        isEnvVar: () => false,
      };
      configAggregatorGetInfoStub.returns(emptyConfig);
    });

    it('should return all orgs when ALLOW_ALL_ORGS is in the allowlist', async () => {
      const allowList = new Set(['ALLOW_ALL_ORGS']);

      const result = await filterAllowedOrgs(mockOrgs, allowList);

      // When ALLOW_ALL_ORGS is present, all orgs should be returned immediately
      expect(result).to.have.length(3);
      expect(result).to.deep.equal(mockOrgs);
    });

    it('should return all orgs when ALLOW_ALL_ORGS is in allowlist even with other entries', async () => {
      // According to the comment: "ORG_ALLOWLIST has ALLOW_ALL_ORGS and 'my-alias' in it and returns *only* ALLOW_ALL_ORGS"
      // This means ALLOW_ALL_ORGS takes precedence and returns all orgs regardless of other entries
      const allowList = new Set(['ALLOW_ALL_ORGS', 'my-alias', 'some-other-entry']);

      const result = await filterAllowedOrgs(mockOrgs, allowList);

      // ALLOW_ALL_ORGS should take precedence and return all orgs
      expect(result).to.have.length(3);
      expect(result).to.deep.equal(mockOrgs);
    });

    it('should filter orgs by username when ALLOW_ALL_ORGS is not present', async () => {
      const allowList = new Set(['org1@example.com', 'org3@example.com']);

      const result = await filterAllowedOrgs(mockOrgs, allowList);

      expect(result).to.have.length(2);
      expect(result[0].username).to.equal('org1@example.com');
      expect(result[1].username).to.equal('org3@example.com');
    });

    it('should filter orgs by alias when ALLOW_ALL_ORGS is not present', async () => {
      const allowList = new Set(['my-alias', 'org3-alias']);

      const result = await filterAllowedOrgs(mockOrgs, allowList);

      expect(result).to.have.length(2);
      expect(result[0].username).to.equal('org2@example.com'); // has 'my-alias'
      expect(result[1].username).to.equal('org3@example.com'); // has 'org3-alias'
    });

    it('should filter orgs by both username and alias', async () => {
      const allowList = new Set(['org1@example.com', 'my-alias']);

      const result = await filterAllowedOrgs(mockOrgs, allowList);

      expect(result).to.have.length(2);
      expect(result[0].username).to.equal('org1@example.com'); // username match
      expect(result[1].username).to.equal('org2@example.com'); // alias match for 'my-alias'
    });

    it('should return empty array when no orgs match the allowlist', async () => {
      const allowList = new Set(['nonexistent@example.com', 'nonexistent-alias']);

      const result = await filterAllowedOrgs(mockOrgs, allowList);

      expect(result).to.have.length(0);
    });

    it('should skip orgs without a username', async () => {
      const orgsWithNoUsername = [
        ...mockOrgs,
        {
          username: undefined, // No username
          aliases: ['test-alias'],
          instanceUrl: 'https://test.salesforce.com',
          isScratchOrg: false,
          isDevHub: false,
          isSandbox: false,
          orgId: '00D000000000004EAA',
          oauthMethod: 'web',
          isExpired: false,
          configs: null,
        },
      ];

      const allowList = new Set(['test-alias']); // This alias exists but org has no username

      const result = await filterAllowedOrgs(orgsWithNoUsername, allowList);

      // Should skip the org without username even though alias matches
      expect(result).to.have.length(0);
    });
  });

  describe('getDefaultTargetOrg', () => {
    beforeEach(() => {
      // Restore and recreate the stub to ensure a clean state
      configAggregatorGetInfoStub.restore?.();
      configAggregatorGetInfoStub = sandbox.stub();

      // Update the mock aggregator to use the new stub
      const mockAggregator = {
        getInfo: configAggregatorGetInfoStub,
      };
      configAggregatorCreateStub.resolves(mockAggregator);
    });

    it('should return target org config when it exists', async () => {
      const mockConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/unique-target-org',
        isLocal: () => true,
        isGlobal: () => false,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(mockConfig);

      const result = await getDefaultTargetOrg();

      // Expect our simplified ConfigInfoWithCache structure
      expect(result).to.deep.equal({
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/unique-target-org',
      });
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

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(mockConfig);

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

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(mockConfig);

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

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(mockConfig);

      // First call
      const result1 = await getDefaultTargetOrg();
      expect(result1).to.deep.equal({
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/cache1',
      });
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call should use cache based on path
      const result2 = await getDefaultTargetOrg();
      expect(result2).to.deep.equal({
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/cache1',
      });
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
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(mockConfig1);
      const result1 = await getDefaultTargetOrg();
      expect(result1).to.deep.equal({
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org1@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path1',
      });
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call with different config path should not use cache
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(mockConfig2);
      const result2 = await getDefaultTargetOrg();
      expect(result2).to.deep.equal({
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org2@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path2',
      });
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
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(mockConfig1);
      const result1 = await getDefaultTargetOrg();
      expect(result1).to.deep.equal({
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/cache2',
      });
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call with same path should use cache
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_ORG).returns(mockConfig2);
      const result2 = await getDefaultTargetOrg();
      expect(result2).to.deep.equal({
        key: OrgConfigProperties.TARGET_ORG,
        value: 'test-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/cache2',
      });
      expect(configAggregatorCreateStub.calledTwice).to.be.true; // ConfigAggregator is called every time to get the path.
    });
  });

  describe('getDefaultTargetDevHub', () => {
    beforeEach(() => {
      // Restore and recreate the stub to ensure a clean state
      configAggregatorGetInfoStub.restore?.();
      configAggregatorGetInfoStub = sandbox.stub();

      // Update the mock aggregator to use the new stub
      const mockAggregator = {
        getInfo: configAggregatorGetInfoStub,
      };
      configAggregatorCreateStub.resolves(mockAggregator);
    });

    it('should return target dev hub config when it exists', async () => {
      const mockConfig: ConfigInfo = {
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/unique-devhub',
        isLocal: () => false,
        isGlobal: () => true,
        isEnvVar: () => false,
      };

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(mockConfig);

      const result = await getDefaultTargetDevHub();

      expect(result).to.deep.equal({
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/unique-devhub',
      });
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

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(mockConfig);

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

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(mockConfig);

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

      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(mockConfig);

      // First call
      const result1 = await getDefaultTargetDevHub();
      expect(result1).to.deep.equal({
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/cache1',
      });
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call should use cache based on path
      const result2 = await getDefaultTargetDevHub();
      expect(result2).to.deep.equal({
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/cache1',
      });
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
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(mockConfig1);
      const result1 = await getDefaultTargetDevHub();
      expect(result1).to.deep.equal({
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub1@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path1',
      });
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call with different config path should not use cache
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(mockConfig2);
      const result2 = await getDefaultTargetDevHub();
      expect(result2).to.deep.equal({
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub2@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path2',
      });
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
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(mockConfig1);
      const result1 = await getDefaultTargetDevHub();
      expect(result1).to.deep.equal({
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/cache2',
      });
      expect(configAggregatorCreateStub.calledOnce).to.be.true;

      // Second call with same path should use cache
      configAggregatorGetInfoStub.withArgs(OrgConfigProperties.TARGET_DEV_HUB).returns(mockConfig2);
      const result2 = await getDefaultTargetDevHub();
      expect(result2).to.deep.equal({
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/cache2',
      });
      expect(configAggregatorCreateStub.calledTwice).to.be.true; // ConfigAggregator is called every time to get the path.
    });

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

      expect(targetOrgResult1).to.deep.equal({
        key: OrgConfigProperties.TARGET_ORG,
        value: 'target-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/isolation1',
      });
      expect(devHubResult1).to.deep.equal({
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/isolation1',
      });
      expect(configAggregatorCreateStub.calledTwice).to.be.true;

      // Second calls should use cache for both
      const targetOrgResult2 = await getDefaultTargetOrg();
      const devHubResult2 = await getDefaultTargetDevHub();

      expect(targetOrgResult2).to.deep.equal({
        key: OrgConfigProperties.TARGET_ORG,
        value: 'target-org@example.com',
        location: ConfigAggregator.Location.LOCAL,
        path: '/test/path/isolation1',
      });
      expect(devHubResult2).to.deep.equal({
        key: OrgConfigProperties.TARGET_DEV_HUB,
        value: 'devhub@example.com',
        location: ConfigAggregator.Location.GLOBAL,
        path: '/global/path/isolation1',
      });
      expect(configAggregatorCreateStub.callCount).to.equal(4); // Called twice for each function (4 total)
    });
  });
});
