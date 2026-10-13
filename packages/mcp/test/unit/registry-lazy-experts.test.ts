/*
 * Copyright 2026, Salesforce, Inc.
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

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'chai';
import { LAZY_EXPERT_PROVIDER_PACKAGES } from '../../src/registry.js';

const here = dirname(fileURLToPath(import.meta.url));
const registrySrcPath = join(here, '../../src/registry.ts');

describe('registry expert provider load gating (forcedotcom/mcp#41)', () => {
  it('lists the known stdout-intercepting expert packages', () => {
    expect(LAZY_EXPERT_PROVIDER_PACKAGES).to.deep.equal([
      '@salesforce/mcp-provider-lwc-experts',
      '@salesforce/mcp-provider-aura-experts',
    ]);
  });

  it('does not statically import aura/lwc expert packages (prevents sf stdout intercept on plugin load)', async () => {
    const src = await readFile(registrySrcPath, 'utf8');

    for (const pkg of LAZY_EXPERT_PROVIDER_PACKAGES) {
      expect(src, `${pkg} must not use a static import`).to.not.match(
        new RegExp(`import\\s+\\{[^}]*\\}\\s+from\\s+['"]${pkg.replace('/', '\\/')}['"]`)
      );
      expect(src, `${pkg} must be dynamically imported`).to.match(
        new RegExp(`import\\(['"]${pkg.replace('/', '\\/')}['"]\\)`)
      );
    }
  });

  it('exposes loadMcpProviders for server-time registration', async () => {
    const src = await readFile(registrySrcPath, 'utf8');
    expect(src).to.match(/export async function loadMcpProviders/);
  });
});
