import { execSync } from "node:child_process";
import path from "node:path";

/** Parsed missing dependency from a deployment error message. */
export interface MissingDependency {
  /** Metadata type, e.g. ApexClass, ApexTrigger, Profile */
  type: string;
  /** Component name, e.g. TestFive, MyTrigger */
  name: string;
}

/**
 * Parse deployment error to extract missing component type and name when present.
 * Handles common formats e.g. "no ApexClass named X found", "In field: apexClass - no ApexClass named X found",
 * and "Variable does not exist: X" (treats X as a potential missing ApexClass in the branch).
 */
export function parseMissingDependency(errorSummary: string): MissingDependency | null {
  const s = errorSummary;
  // "Variable does not exist: Sam_hello" or "Problem: Variable does not exist: X" — treat as missing ApexClass
  const variableMatch = s.match(/Variable\s+does\s+not\s+exist:\s*([A-Za-z0-9_]+)/i);
  if (variableMatch) {
    return { type: "ApexClass", name: variableMatch[1] };
  }
  // "no ApexClass named TestFive found" or "no ApexTrigger named X found"
  const namedMatch = s.match(/no\s+(ApexClass|ApexTrigger|ApexPage|CustomObject|Flow)\s+named\s+([A-Za-z0-9_]+)\s+found/i);
  if (namedMatch) {
    return { type: namedMatch[1], name: namedMatch[2] };
  }
  // "In field: apexClass - no ApexClass named X found (profiles/...)"
  const inFieldMatch = s.match(/apexClass\s*-\s*no\s+ApexClass\s+named\s+([A-Za-z0-9_]+)\s+found/i);
  if (inFieldMatch) {
    return { type: "ApexClass", name: inFieldMatch[1] };
  }
  // "unknown component" with Type: X, or "Component: Name, Type: ApexClass"
  const componentTypeMatch = s.match(/Type:\s*(ApexClass|ApexTrigger|ApexPage|Profile|CustomObject|Flow)/i);
  const componentNameMatch = s.match(/Component:\s*([A-Za-z0-9_]+)/i);
  if (componentTypeMatch && componentNameMatch && !/Variable does not exist|Problem:/i.test(s)) {
    return { type: componentTypeMatch[1], name: componentNameMatch[1] };
  }
  return null;
}

/** Default metadata paths (relative to repo root, forward slashes for git). */
const METADATA_PATHS: Record<string, (name: string) => string[]> = {
  ApexClass: (name) => [
    `force-app/main/default/classes/${name}.cls`,
    `main/default/classes/${name}.cls`,
    `classes/${name}.cls`,
  ],
  ApexTrigger: (name) => [`force-app/main/default/triggers/${name}.trigger`, `main/default/triggers/${name}.trigger`],
  ApexPage: (name) => [`force-app/main/default/pages/${name}.page`, `main/default/pages/${name}.page`],
  Profile: (name) => [`force-app/main/default/profiles/${name}.profile-meta.xml`, `main/default/profiles/${name}.profile-meta.xml`],
  CustomObject: (name) => [
    `force-app/main/default/objects/${name}/${name}.object-meta.xml`,
    `main/default/objects/${name}/${name}.object-meta.xml`,
  ],
  Flow: (name) => [
    `force-app/main/default/flows/${name}.flow-meta.xml`,
    `main/default/flows/${name}.flow-meta.xml`,
  ],
};

/**
 * Return candidate source paths for a given metadata type and name (standard project layout).
 */
export function getSourcePathsForDependency(type: string, name: string): string[] {
  const key = type.charAt(0).toUpperCase() + type.slice(1);
  const fn = METADATA_PATHS[key];
  if (fn) return fn(name);
  return [];
}

/**
 * Try to run git show for a ref:path; try ref first, then origin/ref if ref is not a valid ref.
 */
function gitShowInBranch(repoPath: string, branch: string, relativePath: string): boolean {
  const normalized = relativePath.split(path.sep).join("/");
  const refsToTry = [branch, `origin/${branch}`];
  for (const ref of refsToTry) {
    try {
      execSync(`git show "${ref}:${normalized}"`, {
        cwd: repoPath,
        stdio: ["ignore", "pipe", "pipe"],
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
      });
      return true;
    } catch {
      // ref invalid or file not in branch
    }
  }
  return false;
}

/**
 * Check whether at least one of the given paths exists in the given git branch.
 * Paths must use forward slashes (git convention).
 * Tries branch name first, then origin/branch when branch is only available as a remote ref.
 */
export function isDependencyPresentInBranch(repoPath: string, branch: string, relativePaths: string[]): boolean {
  for (const p of relativePaths) {
    if (gitShowInBranch(repoPath, branch, p)) {
      return true;
    }
  }
  return false;
}
