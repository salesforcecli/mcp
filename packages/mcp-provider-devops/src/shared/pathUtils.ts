import fs from 'fs';
import path from 'path';
import { isGitRepository } from './gitUtils.js';

export function normalizeAndValidateRepoPath(inputPath?: string): string {
  const candidate = (inputPath && inputPath.trim().length > 0) ? inputPath.trim() : process.cwd();
  const unsafePattern = /[\|;&$`><\n\r]/;
  if (unsafePattern.test(candidate)) {
    throw new Error('Unsafe repoPath detected. Please provide a valid local directory path.');
  }
  if (candidate.startsWith('-')) {
    throw new Error('repoPath must be a directory path, not a CLI flag.');
  }
  const absolutePath = path.isAbsolute(candidate) ? candidate : path.resolve(candidate);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolutePath);
  } catch {
    throw new Error(`repoPath does not exist: ${absolutePath}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`repoPath is not a directory: ${absolutePath}`);
  }
  return absolutePath;
}

/**
 * Returns true if the path appears to be a Salesforce/DevOps project:
 * - Must be a Git repository (required for branch/dependency checks).
 * - Must have a common Salesforce project layout (sfdx-project.json, or force-app/, or main/).
 */
export function isSalesforceOrDevOpsProject(repoPath: string): boolean {
  if (!isGitRepository(repoPath)) {
    return false;
  }
  if (fs.existsSync(path.join(repoPath, 'sfdx-project.json'))) return true;
  const forceAppPath = path.join(repoPath, 'force-app');
  const mainPath = path.join(repoPath, 'main');
  try {
    if (fs.existsSync(forceAppPath) && fs.statSync(forceAppPath).isDirectory()) return true;
    if (fs.existsSync(mainPath) && fs.statSync(mainPath).isDirectory()) return true;
  } catch {
    // ignore
  }
  return false;
}
