import { ConfigInfo } from '@salesforce/core';
import { type Nullable } from '@salesforce/ts-types';

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
