#!/usr/bin/env node

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

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '../../../..');
const RESOURCES_DIR = path.resolve(PROJECT_ROOT, 'packages/mcp-provider-mobile-web/resources');
const TEMP_DIR = path.resolve(PROJECT_ROOT, 'temp-lightning-types');

async function downloadAndExtractLightningTypes(): Promise<void> {
  console.log('🔄 Starting update of mobile capability TypeScript type declarations...');

  try {
    // Clean up any existing temp directory
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    // Step 1: Download the latest tarball of @salesforce/lightning-types
    console.log('📦 Downloading latest @salesforce/lightning-types package...');
    const packResult = execSync('npm pack @salesforce/lightning-types@latest', {
      cwd: TEMP_DIR,
      encoding: 'utf-8',
    });

    const tarballName = packResult.trim();
    const tarballPath = path.resolve(TEMP_DIR, tarballName);

    if (!fs.existsSync(tarballPath)) {
      throw new Error(`Tarball not found at ${tarballPath}`);
    }

    console.log(`✅ Downloaded: ${tarballName}`);

    // Step 2: Extract the contents of the tarball
    console.log('📂 Extracting tarball contents...');
    await tar.x({
      file: tarballPath,
      cwd: TEMP_DIR,
    });

    // Step 3: Check if the mobile capabilities directory exists in the extracted package
    const extractedPackageDir = path.resolve(TEMP_DIR, 'package');
    const mobileCapabilitiesSourceDir = path.resolve(extractedPackageDir, 'dist/lightning/mobileCapabilities');

    if (!fs.existsSync(mobileCapabilitiesSourceDir)) {
      throw new Error(`Mobile capabilities directory not found at ${mobileCapabilitiesSourceDir}`);
    }

    console.log('✅ Found mobile capabilities directory in extracted package');

    // Step 4: Replace the contents of packages/mobile-web/resources/
    console.log('🔄 Replacing resources directory contents...');

    // Remove existing resources directory contents
    if (fs.existsSync(RESOURCES_DIR)) {
      fs.rmSync(RESOURCES_DIR, { recursive: true, force: true });
    }

    // Create new resources directory
    fs.mkdirSync(RESOURCES_DIR, { recursive: true });

    await copyWithLowerCaseDirs(mobileCapabilitiesSourceDir, RESOURCES_DIR);

    console.log('✅ Successfully replaced resources directory contents');

    // Clean up temp directory
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });

    console.log('🎉 Mobile capability TypeScript type declarations updated successfully!');
  } catch (error) {
    console.error('❌ Error updating mobile capability type declarations:', error);

    // Clean up temp directory on error
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    process.exit(1);
  }
}

async function copyWithLowerCaseDirs(src: string, dest: string) {
  const entries = await fs.promises.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    let destName = entry.name;
    if (entry.isDirectory()) {
      if (/^[A-Z]/.test(entry.name)) {
        destName = entry.name.charAt(0).toLowerCase() + entry.name.slice(1);
      }
      if (entry.name.endsWith('Service')) {
        destName = destName.slice(0, -7);
      }
    }
    const destPath = path.join(dest, destName);

    if (entry.isDirectory()) {
      await fs.promises.mkdir(destPath, { recursive: true });
      await copyWithLowerCaseDirs(srcPath, destPath);
    } else {
      await fs.promises.copyFile(srcPath, destPath);
    }
  }
}

downloadAndExtractLightningTypes().catch((error) => {
  console.error('Script execution failed:', error);
  process.exit(1);
});

export { downloadAndExtractLightningTypes };
