import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

export function isGitRepository(candidatePath: string): boolean {
  const gitPath = path.join(candidatePath, '.git');
  if (!fs.existsSync(gitPath)) {
    return false;
  }
  const stat = fs.statSync(gitPath);
  if (stat.isDirectory()) {
    return true;
  }
  if (stat.isFile()) {
    try {
      const content = fs.readFileSync(gitPath, 'utf8');
      return content.trim().startsWith('gitdir:');
    } catch {
      return false;
    }
  }
  return false;
}

export function hasUncommittedChanges(candidatePath: string): boolean {
  try {
    const output = execSync('git status --porcelain', { cwd: candidatePath, stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
    return output.length > 0;
  } catch {
    return false;
  }
}


