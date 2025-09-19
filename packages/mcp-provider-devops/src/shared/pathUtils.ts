import fs from 'fs';
import path from 'path';

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
