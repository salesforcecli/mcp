import axios from 'axios';
import { getConnection, getRequiredOrgs } from './shared/auth.js';
import { execFileSync } from 'child_process';
import { normalizeAndValidateRepoPath } from './shared/pathUtils.js';
import path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { convertToSourceComponents } from './shared/sfdxService.js';

interface Change {
    fullName: string;
    type: string;
    operation: string;
}

interface CommitWorkItemParams {
    workItem: { id: string };
    requestId: string;
    commitMessage: string;
    username: string;
    repoPath?: string;
}


export async function commitWorkItem({
    workItem,
    requestId,
    commitMessage,
    username,
    repoPath
}: CommitWorkItemParams): Promise<any> {
    const connection = await getConnection(username);
        const accessToken = connection.accessToken;
        const instanceUrl = connection.instanceUrl;

        if (!accessToken || !instanceUrl) {
            throw new Error('Missing access token or instance URL. Please check if you are authenticated to the org.');
        }


    const workingDir = normalizeAndValidateRepoPath(repoPath);

    const computedChanges = buildComputedChanges(workingDir);
    
    const { commitSha, branch } = AddAndCommitChanges(workingDir, commitMessage);

    const url = `${instanceUrl}/services/data/v65.0/connect/devops/workItems/${workItem.id}/commitlite`;

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    };

    const requestBody = {
        requestId,
        commitMessage,
        'commitId': commitSha,
        changes: computedChanges
    };

    try {
        const response = await axios.post(url, requestBody, { headers });

    return {
            content: [{
              type: "text",
              text: `Changes committed successfully.
              Commit SHA: ${commitSha}
              Agent execution guide (perform these steps now)
              - Push the commit: 'git push'`,
              actionRequired: true
            }],
            isError: false
        };
    } catch (error: any) {
        return {
            content: [{
                type: "text",
                text: `Failed to commit work item: ${error.message}`
            }]
        };
    }
}

function buildComputedChanges(workingDir: string): Change[] {
    const deletedRel = execFileSync('git', ['ls-files', '-d'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);
    const modifiedRel = execFileSync('git', ['ls-files', '-m'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);
    const untrackedRel = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);
    const stagedRel = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: workingDir, encoding: 'utf8' })
        .split('\n').map(l => l.trim()).filter(Boolean);

    const computedChanges: Change[] = [];

    const allRelPaths = Array.from(new Set([
        ...modifiedRel,
        ...untrackedRel,
        ...stagedRel
    ]));

    const registry = new RegistryAccess();
    const componentsExisting = convertToSourceComponents(workingDir, registry, allRelPaths);

    const toPosix = (p: string) => p.replace(/\\/g, '/');
    const untrackedSet = new Set(untrackedRel.map(toPosix));
    const modifiedSet = new Set(modifiedRel.map(toPosix));
    const stagedSet = new Set(stagedRel.map(toPosix));

    for (const comp of componentsExisting) {
        const relPath = toPosix(path.relative(workingDir, comp.filePath));
        let operation: 'delete' | 'add' | 'modify' | undefined;

        if (untrackedSet.has(relPath)) {
            operation = 'add';
        } else if (modifiedSet.has(relPath) || stagedSet.has(relPath)) {
            operation = 'modify';
        }

        if (operation) {
            computedChanges.push({ fullName: comp.fullName, type: comp.type.name, operation });
        }
    }

    if (deletedRel.length > 0) {
        const componentsDeleted = getComponentsForDeletedPaths(workingDir, deletedRel);
        for (const comp of componentsDeleted) {
            computedChanges.push({ fullName: comp.fullName, type: comp.type.name, operation: 'delete' });
        }
    }

    if (computedChanges.length === 0) {
        throw new Error('No eligible changes to commit (only Unchanged components detected).');
    }

    return computedChanges;
}

function getComponentsForDeletedPaths(workingDir: string, deletedRel: string[]) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deleted-components-'));
    const registry = new RegistryAccess();

    const restoreFileFromGit = (rel: string) => {
        const dest = path.join(tempDir, rel);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        const content = execFileSync('git', ['show', `HEAD:${rel}`], { cwd: workingDir });
        fs.writeFileSync(dest, content);
    };

    const restoreBundleFromGit = (bundleRelDir: string) => {
        const files = execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', bundleRelDir], { cwd: workingDir, encoding: 'utf8' })
            .split('\n').map(l => l.trim()).filter(Boolean);
        for (const f of files) {
            restoreFileFromGit(f);
        }
    };

    const isBundleType = (rel: string): { isBundle: boolean; bundleRoot?: string } => {
        const parts = rel.split(/[\\/]/g);
        const idxAura = parts.indexOf('aura');
        const idxLwc = parts.indexOf('lwc');
        const idxExp = parts.indexOf('experiences');
        const idxStatic = parts.indexOf('staticresources');
        if (idxAura >= 0 && parts.length >= idxAura + 2) {
            const root = parts.slice(0, idxAura + 2).join('/');
            return { isBundle: true, bundleRoot: root };
        }
        if (idxLwc >= 0 && parts.length >= idxLwc + 2) {
            const root = parts.slice(0, idxLwc + 2).join('/');
            return { isBundle: true, bundleRoot: root };
        }
        if (idxExp >= 0 && parts.length >= idxExp + 2) {
            const root = parts.slice(0, idxExp + 2).join('/');
            return { isBundle: true, bundleRoot: root };
        }
        if (idxStatic >= 0 && parts.length >= idxStatic + 1) {
            if (parts[parts.length - 1].endsWith('.resource') || parts[parts.length - 1].endsWith('.resource-meta.xml')) {
                return { isBundle: false };
            }
            const root = parts.slice(0, idxStatic + 2).join('/');
            return { isBundle: true, bundleRoot: root };
        }
        return { isBundle: false };
    };

    for (const rel of deletedRel) {
        const { isBundle, bundleRoot } = isBundleType(rel);
        try {
            if (isBundle && bundleRoot) {
                restoreBundleFromGit(bundleRoot);
            } else {
                restoreFileFromGit(rel);
                if (!rel.endsWith('-meta.xml')) {
                    const metaRel = rel + '-meta.xml';
                    try { restoreFileFromGit(metaRel); } catch {}
                }
            }
        } catch {
            // ignore failures for paths that may not exist in HEAD
        }
    }

    const componentsDeleted = convertToSourceComponents(tempDir, registry, deletedRel);
    fs.rmSync(tempDir, { recursive: true, force: true });
    return componentsDeleted;
}

export function AddAndCommitChanges(
    workingDir: string,
    commitMessage: string,
): { commitSha: string; branch: string } {
    

    // Stage all changes (adds/modifies/deletes)
    execFileSync('git', ['add', '--all'], { cwd: workingDir, encoding: 'utf8' });

    // If nothing to commit, surface clearly
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: workingDir, encoding: 'utf8' }).trim();
    if (!status) {
        throw new Error('No file changes to commit. Working tree is clean.');
    }

    // Create commit
    execFileSync('git', ['commit', '-m', commitMessage], { cwd: workingDir, encoding: 'utf8' });

    // Get commit SHA
    const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workingDir, encoding: 'utf8' }).trim();

    return { commitSha, branch: '' };
}