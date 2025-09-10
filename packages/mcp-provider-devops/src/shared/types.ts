
import { ConfigInfo as _ConfigInfo } from '@salesforce/core';
import { type Nullable } from '@salesforce/ts-types';

// AUTH TYPES
export type SanitizedOrgAuthorization = {
  aliases?: Nullable<string[]>;
  configs?: Nullable<string[]>;
  username?: string;
  instanceUrl?: string;
  isScratchOrg?: boolean;
  isDevHub?: boolean;
  isSandbox?: boolean;
  orgId?: string;
  oauthMethod?: string;
  isExpired?: boolean | 'unknown';
};
