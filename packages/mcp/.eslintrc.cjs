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

const path = require('path');
const fs = require('fs');

// Determine the correct path based on current working directory
function getTsConfigPaths() {
  const cwd = process.cwd();

  // Check if we're running from the monorepo root (contains packages/ directory)
  const isMonorepoRoot = fs.existsSync(path.join(cwd, 'packages'));

  if (isMonorepoRoot) {
    // Running from monorepo root (e.g., yarn lint from root)
    return ['./packages/mcp/tsconfig.json', './packages/mcp/test/tsconfig.json'];
  } else {
    // Running from package directory (e.g., yarn lint from within package)
    return ['./tsconfig.json', './test/tsconfig.json'];
  }
}

module.exports = {
  extends: ['eslint-config-salesforce-typescript', 'eslint-config-salesforce-license'],
  parserOptions: {
    project: getTsConfigPaths(),
  },
  rules: {
    camelcase: 'off',
    'class-methods-use-this': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
  },
};
