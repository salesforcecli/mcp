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

import { ConfigInfo } from '@salesforce/core';
import { type Nullable } from '@salesforce/ts-types';

export type ConfigInfoWithCache = {
  key: string;
  location?: ConfigInfo['location'];
  value: string;
  cached?: boolean;
  path: string;
};

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

// TOOL RESPONSES
export type ToolTextResponse = {
  isError: boolean;
  content: Array<{
    type: 'text';
    text: string;
  }>;
};
