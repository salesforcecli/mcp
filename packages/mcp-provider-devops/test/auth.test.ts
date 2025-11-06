import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SanitizedOrgAuthorization } from '../src/shared/types.js';
import { AuthInfo } from '@salesforce/core';

// Import the actual implementation - we'll mock AuthInfo instead
import { findOrgByUsernameOrAlias, getRequiredOrgs } from '../src/shared/auth.js';

// Mock @salesforce/core to avoid real authentication calls
vi.mock('@salesforce/core', async () => {
  const actual = await vi.importActual('@salesforce/core');
  return {
    ...actual,
    AuthInfo: {
      listAllAuthorizations: vi.fn(),
      create: vi.fn(),
    },
    Connection: {
      create: vi.fn(),
    },
  };
});

describe('findOrgByUsernameOrAlias', () => {
  const mockOrgs: SanitizedOrgAuthorization[] = [
    {
      username: 'devops@example.com',
      aliases: ['devops-org', 'doce'],
      instanceUrl: 'https://devops.salesforce.com',
      isScratchOrg: false,
      isDevHub: false,
      isSandbox: false,
      orgId: '00D1234567890001',
      oauthMethod: 'web',
      isExpired: false,
      configs: null,
    },
    {
      username: 'sandbox@example.com',
      aliases: ['sandbox-org', 'dev-sandbox'],
      instanceUrl: 'https://sandbox.salesforce.com',
      isScratchOrg: false,
      isDevHub: false,
      isSandbox: true,
      orgId: '00D1234567890002',
      oauthMethod: 'web',
      isExpired: false,
      configs: null,
    },
    {
      username: 'scratch@example.com',
      aliases: ['scratch-org'],
      instanceUrl: 'https://scratch.salesforce.com',
      isScratchOrg: true,
      isDevHub: false,
      isSandbox: false,
      orgId: '00D1234567890003',
      oauthMethod: 'jwt',
      isExpired: false,
      configs: null,
    },
    {
      username: 'noalias@example.com',
      aliases: null,
      instanceUrl: 'https://noalias.salesforce.com',
      isScratchOrg: false,
      isDevHub: true,
      isSandbox: false,
      orgId: '00D1234567890004',
      oauthMethod: 'web',
      isExpired: false,
      configs: null,
    },
  ];

  describe('find by username', () => {
    it('should find org by exact username match', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'devops@example.com');

      expect(result).toBeDefined();
      expect(result?.username).toBe('devops@example.com');
      expect(result?.aliases).toEqual(['devops-org', 'doce']);
    });

    it('should find org by username when org has multiple aliases', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'sandbox@example.com');

      expect(result).toBeDefined();
      expect(result?.username).toBe('sandbox@example.com');
      expect(result?.aliases).toEqual(['sandbox-org', 'dev-sandbox']);
    });

    it('should find org by username when org has null aliases', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'noalias@example.com');

      expect(result).toBeDefined();
      expect(result?.username).toBe('noalias@example.com');
      expect(result?.aliases).toBeNull();
    });
  });

  describe('find by alias', () => {
    it('should find org by first alias', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'devops-org');

      expect(result).toBeDefined();
      expect(result?.username).toBe('devops@example.com');
      expect(result?.aliases).toContain('devops-org');
    });

    it('should find org by second alias', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'doce');

      expect(result).toBeDefined();
      expect(result?.username).toBe('devops@example.com');
      expect(result?.aliases).toContain('doce');
    });

    it('should find org by any alias when org has multiple aliases', () => {
      const result1 = findOrgByUsernameOrAlias(mockOrgs, 'sandbox-org');
      const result2 = findOrgByUsernameOrAlias(mockOrgs, 'dev-sandbox');

      expect(result1).toBeDefined();
      expect(result1?.username).toBe('sandbox@example.com');
      expect(result2).toBeDefined();
      expect(result2?.username).toBe('sandbox@example.com');
    });

    it('should find scratch org by alias', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'scratch-org');

      expect(result).toBeDefined();
      expect(result?.username).toBe('scratch@example.com');
      expect(result?.isScratchOrg).toBe(true);
    });
  });

  describe('not found scenarios', () => {
    it('should return undefined when username is not found', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'nonexistent@example.com');

      expect(result).toBeUndefined();
    });

    it('should return undefined when alias is not found', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'nonexistent-alias');

      expect(result).toBeUndefined();
    });

    it('should return undefined when searching empty array', () => {
      const result = findOrgByUsernameOrAlias([], 'devops@example.com');

      expect(result).toBeUndefined();
    });

    it('should return undefined when searching with empty string', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, '');

      expect(result).toBeUndefined();
    });
  });

  describe('edge cases', () => {
    it('should handle orgs with empty aliases array', () => {
      const orgsWithEmptyAliases: SanitizedOrgAuthorization[] = [
        {
          username: 'test@example.com',
          aliases: [],
          instanceUrl: 'https://test.salesforce.com',
          isScratchOrg: false,
          isDevHub: false,
          isSandbox: false,
          orgId: '00D1234567890005',
          oauthMethod: 'web',
          isExpired: false,
          configs: null,
        },
      ];

      const result = findOrgByUsernameOrAlias(orgsWithEmptyAliases, 'test@example.com');

      expect(result).toBeDefined();
      expect(result?.username).toBe('test@example.com');
    });

    it('should be case-sensitive for username match', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'DEVOPS@EXAMPLE.COM');

      expect(result).toBeUndefined();
    });

    it('should be case-sensitive for alias match', () => {
      const result = findOrgByUsernameOrAlias(mockOrgs, 'DEVOPS-ORG');

      expect(result).toBeUndefined();
    });
  });
});

describe('getRequiredOrgs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockOrgAuthorizations = [
    {
      username: 'devops@example.com',
      aliases: ['devops-org', 'doce'],
      instanceUrl: 'https://devops.salesforce.com',
      isScratchOrg: false,
      isDevHub: false,
      isSandbox: false,
      orgId: '00D1234567890001',
      oauthMethod: 'web',
      isExpired: false,
      configs: null,
      accessToken: 'fake-token-1',
    },
    {
      username: 'sandbox@example.com',
      aliases: ['sandbox-org', 'dev-sandbox'],
      instanceUrl: 'https://sandbox.salesforce.com',
      isScratchOrg: false,
      isDevHub: false,
      isSandbox: true,
      orgId: '00D1234567890002',
      oauthMethod: 'web',
      isExpired: false,
      configs: null,
      accessToken: 'fake-token-2',
    },
  ];

  describe('find orgs by username', () => {
    it('should find both orgs by username', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('devops@example.com', 'sandbox@example.com');

      expect(result.doceHub).toBeDefined();
      expect(result.doceHub?.username).toBe('devops@example.com');
      expect(result.sandbox).toBeDefined();
      expect(result.sandbox?.username).toBe('sandbox@example.com');
      expect(result.error).toBeUndefined();
    });
  });

  describe('find orgs by alias', () => {
    it('should find both orgs by alias', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('devops-org', 'sandbox-org');

      expect(result.doceHub).toBeDefined();
      expect(result.doceHub?.username).toBe('devops@example.com');
      expect(result.sandbox).toBeDefined();
      expect(result.sandbox?.username).toBe('sandbox@example.com');
      expect(result.error).toBeUndefined();
    });

    it('should find DevOps org by username and sandbox by alias', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('devops@example.com', 'dev-sandbox');

      expect(result.doceHub).toBeDefined();
      expect(result.doceHub?.username).toBe('devops@example.com');
      expect(result.sandbox).toBeDefined();
      expect(result.sandbox?.username).toBe('sandbox@example.com');
      expect(result.error).toBeUndefined();
    });

    it('should find DevOps org by alias and sandbox by username', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('doce', 'sandbox@example.com');

      expect(result.doceHub).toBeDefined();
      expect(result.doceHub?.username).toBe('devops@example.com');
      expect(result.sandbox).toBeDefined();
      expect(result.sandbox?.username).toBe('sandbox@example.com');
      expect(result.error).toBeUndefined();
    });

    it('should find DevOps org by second alias', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('doce', 'dev-sandbox');

      expect(result.doceHub).toBeDefined();
      expect(result.doceHub?.username).toBe('devops@example.com');
      expect(result.sandbox).toBeDefined();
      expect(result.sandbox?.username).toBe('sandbox@example.com');
      expect(result.error).toBeUndefined();
    });
  });

  describe('error scenarios', () => {
    it('should return error when DevOps org is not found by username', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('nonexistent@example.com', 'sandbox@example.com');

      expect(result.doceHub).toBeNull();
      expect(result.sandbox).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain("DevOps Center org 'nonexistent@example.com' not found");
    });

    it('should return error when DevOps org is not found by alias', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('nonexistent-alias', 'sandbox@example.com');

      expect(result.doceHub).toBeNull();
      expect(result.sandbox).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain("DevOps Center org 'nonexistent-alias' not found");
    });

    it('should return error when sandbox org is not found by username', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('devops@example.com', 'nonexistent@example.com');

      expect(result.doceHub).toBeDefined();
      expect(result.sandbox).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Sandbox org 'nonexistent@example.com' not found");
    });

    it('should return error when sandbox org is not found by alias', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('devops@example.com', 'nonexistent-alias');

      expect(result.doceHub).toBeDefined();
      expect(result.sandbox).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error).toContain("Sandbox org 'nonexistent-alias' not found");
    });

    it('should return combined errors when both orgs are not found', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('nonexistent1@example.com', 'nonexistent2@example.com');

      expect(result.doceHub).toBeNull();
      expect(result.sandbox).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error).toContain("DevOps Center org 'nonexistent1@example.com' not found");
      expect(result.error).toContain("Sandbox org 'nonexistent2@example.com' not found");
    });

    it('should return error when both orgs are the same (by username)', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('devops@example.com', 'devops@example.com');

      expect(result.doceHub).toBeDefined();
      expect(result.sandbox).toBeDefined();
      expect(result.error).toBeDefined();
      expect(result.error).toContain('DevOps Center and Sandbox cannot be the same org');
    });

    it('should return error when both orgs resolve to the same org (username and alias)', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('devops@example.com', 'devops-org');

      expect(result.doceHub).toBeDefined();
      expect(result.sandbox).toBeDefined();
      expect(result.doceHub?.username).toBe('devops@example.com');
      expect(result.sandbox?.username).toBe('devops@example.com');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('DevOps Center and Sandbox cannot be the same org');
    });

    it('should return error when both orgs resolve to the same org (both aliases)', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(mockOrgAuthorizations);

      const result = await getRequiredOrgs('devops-org', 'doce');

      expect(result.doceHub).toBeDefined();
      expect(result.sandbox).toBeDefined();
      expect(result.doceHub?.username).toBe('devops@example.com');
      expect(result.sandbox?.username).toBe('devops@example.com');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('DevOps Center and Sandbox cannot be the same org');
    });
  });

  describe('edge cases', () => {
    it('should handle empty org list', async () => {
      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue([]);

      const result = await getRequiredOrgs('devops@example.com', 'sandbox@example.com');

      expect(result.doceHub).toBeNull();
      expect(result.sandbox).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.error).toContain("DevOps Center org 'devops@example.com' not found");
      expect(result.error).toContain("Sandbox org 'sandbox@example.com' not found");
    });

    it('should handle orgs with null aliases', async () => {
      const orgsWithNullAliases: SanitizedOrgAuthorization[] = [
        {
          username: 'devops@example.com',
          aliases: null,
          instanceUrl: 'https://devops.salesforce.com',
          isScratchOrg: false,
          isDevHub: false,
          isSandbox: false,
          orgId: '00D1234567890001',
          oauthMethod: 'web',
          isExpired: false,
          configs: null,
        },
        {
          username: 'sandbox@example.com',
          aliases: null,
          instanceUrl: 'https://sandbox.salesforce.com',
          isScratchOrg: false,
          isDevHub: false,
          isSandbox: true,
          orgId: '00D1234567890002',
          oauthMethod: 'web',
          isExpired: false,
          configs: null,
        },
      ];

      (AuthInfo.listAllAuthorizations as vi.Mock).mockResolvedValue(orgsWithNullAliases);

      const result = await getRequiredOrgs('devops@example.com', 'sandbox@example.com');

      expect(result.doceHub).toBeDefined();
      expect(result.doceHub?.username).toBe('devops@example.com');
      expect(result.sandbox).toBeDefined();
      expect(result.sandbox?.username).toBe('sandbox@example.com');
      expect(result.error).toBeUndefined();
    });
  });
});

