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

import { z } from 'zod';

/*
 * A collection of reuseable Tool parameters
 */

export const usernameOrAliasParam = z.string()
  .describe(`The username or alias for the Salesforce org to run this tool against.

AGENT INSTRUCTIONS:
If it is not clear what username or alias is, run the #sf-suggest-username tool.
DO NOT use #sf-suggest-username if the user says something like "for my default org" or "for my the org 'an-alias' or 'for my test-prgelc2petd9@example.com org'.

USAGE:
...for the my-alias org
...for my 'my-alias' user
...for alias myAlias
...for my 'test@example.com' user
...for the 'test@example.com' org`);

export const useToolingApiParam = z
  .boolean()
  .optional()
  .describe('Use Tooling API to insert a record in a Tooling API object');
