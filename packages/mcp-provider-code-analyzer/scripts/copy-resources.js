#!/usr/bin/env node
/**
 * Copies resources from src/resources to dist/resources during build
 * Removes existing dist/resources content first to ensure exact match
 */
import { cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..');
const srcResources = join(packageRoot, 'src', 'resources');
const distResources = join(packageRoot, 'dist', 'resources');

try {
    console.log('📦 Copying resources to dist...');
    // Remove existing dist/resources to ensure exact match with src/resources
    // This ensures files deleted from src/resources are also removed from dist/resources
    rmSync(distResources, { recursive: true, force: true });
    // Copy src/resources to dist/resources
    cpSync(srcResources, distResources, { recursive: true, force: true });
    console.log('✅ Resources copied successfully');
} catch (error) {
    console.error('❌ Error copying resources:', error);
    process.exit(1);
}
