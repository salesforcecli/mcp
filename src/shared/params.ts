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
import { sanitizePath } from './utils.js';

/*
 * A collection of reuseable Tool parameters
 */

export const usernameOrAliasParam = z.string()
  .describe(`The username or alias for the Salesforce org to run this tool against.

AGENT INSTRUCTIONS:
If it is not clear what username or alias is, run the #sf-get-username tool.
NEVER guess or make-up a username or alias, use #sf-get-username if you are not sure.
DO NOT use #sf-get-username if the user mentions an alias or username, like "for my an-alias org" or "for my test-prgelc2petd9@example.com org".

USAGE:
...for the my-alias org
...for my 'my-alias' user
...for alias myAlias
...for my 'test@example.com' user
...for the 'test@example.com' org`);

export const useToolingApiParam = z.boolean().optional().describe('Use Tooling API for the operation');

export const baseAbsolutePathParam = z
  .string()
  .refine(sanitizePath, 'Invalid path: Must be an absolute path and cannot contain path traversal sequences');

export const directoryParam = baseAbsolutePathParam.describe(`The directory to run this tool from.
AGENT INSTRUCTIONS:
We need to know where the user wants to run this tool from.
Look at your current Workspace Context to determine this filepath.
ALWAYS USE A FULL PATH TO THE DIRECTORY.
Unless the user explicitly asks for a different directory, or a new directory is created from the action of a tool, use this same directory for future tool calls.
`);
