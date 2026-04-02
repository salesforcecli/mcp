import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

/** Allowlist for git branch/ref names to prevent command injection. Only safe characters. */
const GIT_REF_SAFE_REGEX = /^[a-zA-Z0-9/_.-]{1,255}$/;

/**
 * Validates that a string is a safe git branch/ref name (no shell metacharacters or path traversal).
 * Use before passing LLM or user input to git commands.
 * @throws Error if the branch name is invalid or unsafe
 */
export function validateGitBranchName(branchName: string): string {
  const trimmed = branchName.trim();
  if (!trimmed) {
    throw new Error("Branch name cannot be empty");
  }
  if (trimmed.includes("..")) {
    throw new Error("Branch name must not contain '..'");
  }
  if (!GIT_REF_SAFE_REGEX.test(trimmed)) {
    throw new Error(
      "Branch name may only contain letters, numbers, slashes, underscores, periods, and hyphens"
    );
  }
  return trimmed;
}

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

export function getCurrentBranch(candidatePath: string): string | undefined {
  try {
    const output = execSync('git rev-parse --abbrev-ref HEAD', { cwd: candidatePath, stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
    return output || undefined;
  } catch {
    return undefined;
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
    const strictMatch = sameHost && sameOwner && sameRepo;
    if (strictMatch) {
      return [true, repo.url];
    }

    // Bitbucket can sometimes return display-name owner values from API payloads
    // while git remotes use workspace slugs. If host and
    // repo name match, allow the comparison when one owner looks like a display name.
    if (sameHost && sameRepo && isBitbucketHost(a.host) && (isLikelyDisplayOwner(a.owner) || isLikelyDisplayOwner(b.owner))) {
      return [true, repo.url];
    }

    return [false, repo.url];
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
      return { host, owner: safeDecodePathToken(owner).toLowerCase(), repo };
    }

    // Normalize git+ssh to ssh so URL can parse
    const normalized = input.replace(/^git\+ssh:/, 'ssh:');
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();
    const pathPart = url.pathname.replace(/^\/+/, '');
    const [owner, repoRaw] = pathPart.split('/') as [string, string];
    if (!owner || !repoRaw) return null;
    const repo = stripGitSuffix(repoRaw).toLowerCase();
    return { host, owner: safeDecodePathToken(owner).toLowerCase(), repo };
  } catch {
    return null;
  }
}

function safeDecodePathToken(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isBitbucketHost(host: string): boolean {
  return host === "bitbucket.org";
}

function isLikelyDisplayOwner(owner: string): boolean {
  return /\s/.test(owner);
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


