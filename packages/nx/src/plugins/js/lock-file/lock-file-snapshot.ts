import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { ProjectGraph } from '../../../config/project-graph';
import { hashArray } from '../../../hasher/file-hasher';
import type { CreateNodesContext } from '../../../project-graph/plugins';
import { workspaceDataDirectory } from '../../../utils/cache-directory';
import {
  detectPackageManager,
  type PackageManager,
} from '../../../utils/package-manager';
import { nxVersion } from '../../../utils/versions';
import { jsPluginConfig } from '../utils/config';
import {
  BUN_TEXT_LOCK_FILE,
  getBunPatchFileHashes,
  readBunLockFile,
} from './bun-parser';
import { getLockFileName, getLockFileNodes } from './lock-file';

// Each cache file holds its key, so key and data come from one write.
// Older Nx versions read other names with a hash file; keep these distinct.
export const externalNodesCache = join(
  workspaceDataDirectory,
  'lockfile-nodes.json'
);
export const dependenciesCache = join(
  workspaceDataDirectory,
  'lockfile-dependencies.json'
);

export interface ExternalNodesCache {
  nodes: ProjectGraph['externalNodes'];
  keyMap: Record<string, any>;
  // The lockfile does not cover these sources' contents, so the cached node
  // hashes are folded with them on every read.
  localPathSources?: Record<string, string[]>;
  installedLocalPathNodes: Record<string, Record<string, string>>;
}

export interface LockFileContents {
  packageManager: PackageManager;
  lockFile: string;
  lockFileContents: string;
  lockFileHash: string;
  bunPatchFileHashes?: Map<string, string>;
}

export interface LockFileSnapshot {
  lockFileHash: string;
  /**
   * Whether an `externalDependencies` input naming `packageName` finds a node
   * from this lockfile. Mirrors the task hasher's lookup. The nodes load on
   * the first call.
   */
  hasExternalDependency(packageName: string): boolean;
}

export function readLockFile(
  workspaceRoot: string,
  packageManager: PackageManager,
  lockFile: string
): LockFileContents {
  const lockFilePath = join(workspaceRoot, lockFile);
  const lockFileContents =
    packageManager !== 'bun'
      ? readFileSync(lockFilePath, 'utf-8')
      : readBunLockFile(lockFilePath);
  const bunPatchFileHashes =
    lockFile === BUN_TEXT_LOCK_FILE
      ? getBunPatchFileHashes(workspaceRoot)
      : undefined;
  return {
    packageManager,
    lockFile,
    lockFileContents,
    lockFileHash: hashArray([
      nxVersion,
      lockFileContents,
      ...[...(bunPatchFileHashes ?? [])].flat(),
    ]),
    bunPatchFileHashes,
  };
}

export function readCachedExternalNodes(
  lockFileHash: string
): ExternalNodesCache | undefined {
  const cached = readCache<ExternalNodesCache>(
    externalNodesCache,
    lockFileHash
  );
  // An older build of the same version writes no record, so its entry misses
  return cached?.installedLocalPathNodes ? cached : undefined;
}

export function readCache<T>(path: string, key: string): T | undefined {
  try {
    const cache = JSON.parse(readFileSync(path, 'utf-8'));
    return cache.key === key ? cache.data : undefined;
  } catch {
    // Another process can be mid-write, so an unreadable cache is a miss.
    return undefined;
  }
}

/**
 * The lockfile the built-in js plugin creates external nodes from, or
 * `undefined` when lockfile analysis is off or the lockfile is missing. Nodes
 * come from that plugin's cache when it holds this lockfile, else from a
 * parse. Only the built-in plugin writes the cache.
 */
export function readLockFileSnapshot(
  context: CreateNodesContext
): LockFileSnapshot | undefined {
  if (!jsPluginConfig(context.nxJsonConfiguration).analyzeLockfile) {
    return undefined;
  }
  const packageManager = detectPackageManager(context.workspaceRoot);
  const lockFile = getLockFileName(packageManager);
  if (!existsSync(join(context.workspaceRoot, lockFile))) {
    return undefined;
  }

  const contents = readLockFile(
    context.workspaceRoot,
    packageManager,
    lockFile
  );
  let nodes: ProjectGraph['externalNodes'] | undefined;
  const getNodes = () =>
    (nodes ??=
      readCachedExternalNodes(contents.lockFileHash)?.nodes ??
      getLockFileNodes(
        packageManager,
        lockFile,
        contents.lockFileContents,
        contents.lockFileHash,
        context,
        contents.bunPatchFileHashes
      ).nodes);

  return {
    lockFileHash: contents.lockFileHash,
    hasExternalDependency(packageName) {
      const nodes = getNodes();
      if (Object.hasOwn(nodes, packageName)) {
        return true;
      }
      const npmNode = nodes[`npm:${packageName}`];
      if (npmNode && !npmNode.data.version.startsWith('link:')) {
        return true;
      }
      return Object.values(nodes).some(
        (node) => node.data.packageName === packageName
      );
    },
  };
}
