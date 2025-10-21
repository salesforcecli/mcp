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

export function isSameGitRepo(repoUrl: string, repoPath: string): [boolean, string] {
  const repo = getRepo(repoPath);

  const a = parseGitUrlParts(repo.url);
  const b = parseGitUrlParts(repoUrl);

  if (a && b) {
    const sameHost = a.host === b.host;
    const sameOwner = a.owner === b.owner;
    const sameRepo = a.repo === b.repo;
    return [sameHost && sameOwner && sameRepo, repo.url];
  }

  // Fallback: normalize simple differences (.git suffix, trailing slashes, case)
  const normA = normalizeGitUrlString(repo.url);
  const normB = normalizeGitUrlString(repoUrl);
  return [normA === normB, repo.url];
}

function getRepo(repoPath: string): { url: string } {
  const repo = execSync('git remote get-url origin', { cwd: repoPath }).toString().trim();
  return { url: repo };
}

function parseGitUrlParts(input: string): { host: string; owner: string; repo: string } | null {
  try {
    // Handle SCP-like SSH syntax: git@host:owner/repo.git
    const scpLikeMatch = input.match(/^([^@]+)@([^:]+):(.+)$/);
    if (scpLikeMatch) {
      const host = scpLikeMatch[2].toLowerCase();
      const pathPart = scpLikeMatch[3].replace(/^\/+/, '');
      const [owner, repoRaw] = pathPart.split('/') as [string, string];
      if (!owner || !repoRaw) return null;
      const repo = stripGitSuffix(repoRaw).toLowerCase();
      return { host, owner: owner.toLowerCase(), repo };
    }

    // Normalize git+ssh to ssh so URL can parse
    const normalized = input.replace(/^git\+ssh:/, 'ssh:');
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    const pathPart = url.pathname.replace(/^\/+/, '');
    const [owner, repoRaw] = pathPart.split('/') as [string, string];
    if (!owner || !repoRaw) return null;
    const repo = stripGitSuffix(repoRaw).toLowerCase();
    return { host, owner: owner.toLowerCase(), repo };
  } catch {
    return null;
  }
}

function stripGitSuffix(name: string): string {
  return name.endsWith('.git') ? name.slice(0, -4) : name;
}

function normalizeGitUrlString(input: string): string {
  const parts = parseGitUrlParts(input);
  if (parts) {
    return `${parts.host}/${parts.owner}/${parts.repo}`;
  }
  // Best-effort textual normalization
  return input.replace(/\.git$/i, '').replace(/\/+$/, '').toLowerCase();
}


