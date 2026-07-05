import { readFileSync } from 'fs';
import { join } from 'path';
import { performance } from 'perf_hooks';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';
import { hashArray } from '../../hasher/file-hasher';
import {
  CreateDependencies,
  CreateDependenciesContext,
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
} from '../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../project-graph/project-graph-builder';
import { workspaceDataDirectory } from '../../utils/cache-directory';
import { combineGlobPatterns } from '../../utils/globs';
import { logger } from '../../utils/logger';
import {
  detectPackageManager,
  PackageManager,
} from '../../utils/package-manager';
import {
  safeWriteFileCache,
  tryRemoveFile,
} from '../../utils/plugin-cache-utils';
import { nxVersion } from '../../utils/versions';
import { workspaceRoot } from '../../utils/workspace-root';
import { readBunLockFile } from './lock-file/bun-parser';
import {
  getLockFileDependencies,
  getLockFileName,
  getLockFileNodes,
  lockFileExists,
  LOCKFILES,
} from './lock-file/lock-file';
import { buildExplicitDependencies } from './project-graph/build-dependencies/build-dependencies';
import { jsPluginConfig } from './utils/config';

export const name = 'nx/js/dependencies-and-lockfile';

interface LockfileParseState {
  lockFileHash: string;
  nodes: ProjectGraph['externalNodes'];
  keyMap: Map<string, any>;
}

// In-memory parse state shared between createNodes and createDependencies.
// One object so nodes, keyMap, and the lockfile hash they were derived from
// can never drift apart - the dependencies cache is only trusted when it
// matches this hash.
let inMemoryLockfileState: LockfileParseState | undefined;

export const createNodes: CreateNodes = [
  combineGlobPatterns(LOCKFILES),
  (files, _, context) => {
    return createNodesFromFiles(internalCreateNodes, files, _, context);
  },
];

function internalCreateNodes(lockFile: string, _, context: CreateNodesContext) {
  const pluginConfig = jsPluginConfig(context.nxJsonConfiguration);
  if (!pluginConfig.analyzeLockfile) {
    return {};
  }

  const packageManager = detectPackageManager(workspaceRoot);

  // Only process the correct lockfile
  if (lockFile !== getLockFileName(packageManager)) {
    return {};
  }

  const lockFilePath = join(workspaceRoot, lockFile);
  const lockFileContents = readLockFileContents(packageManager, lockFilePath);
  const lockFileHash = getLockFileHash(lockFileContents);

  const cached = readCachedExternalNodes(lockFileHash);
  if (cached) {
    inMemoryLockfileState = { lockFileHash, ...cached };

    return {
      externalNodes: cached.nodes,
    };
  }

  const { nodes: externalNodes, keyMap } = getLockFileNodes(
    packageManager,
    lockFileContents,
    lockFileHash,
    context
  );
  inMemoryLockfileState = { lockFileHash, nodes: externalNodes, keyMap };

  writeExternalNodesCache(lockFileHash, externalNodes, keyMap);

  return {
    externalNodes,
  };
}

export const createDependencies: CreateDependencies = (
  _,
  ctx: CreateDependenciesContext
) => {
  const pluginConfig = jsPluginConfig(ctx.nxJsonConfiguration);

  const packageManager = detectPackageManager(workspaceRoot);

  let lockfileDependencies: RawProjectGraphDependency[] = [];
  // lockfile may not exist yet
  if (
    pluginConfig.analyzeLockfile &&
    lockFileExists(packageManager) &&
    inMemoryLockfileState
  ) {
    lockfileDependencies = getLockfileDependenciesSafely(
      packageManager,
      inMemoryLockfileState,
      ctx
    );
  }

  performance.mark('build typescript dependencies - start');
  const explicitProjectDependencies = buildExplicitDependencies(
    pluginConfig,
    ctx
  );
  performance.mark('build typescript dependencies - end');
  performance.measure(
    'build typescript dependencies',
    'build typescript dependencies - start',
    'build typescript dependencies - end'
  );
  return lockfileDependencies.concat(explicitProjectDependencies);
};

/**
 * Computes the workspace's external dependency edges from the lockfile,
 * reusing the on-disk cache when it is consistent with the external nodes
 * currently in memory. Never throws and never emits an edge referencing a
 * node the graph does not have: bad cache state falls back to reparsing, and
 * a failed parse degrades to "no lockfile dependencies for this run" instead
 * of failing the whole project graph.
 */
function getLockfileDependenciesSafely(
  packageManager: PackageManager,
  state: LockfileParseState,
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  const lockFilePath = join(workspaceRoot, getLockFileName(packageManager));
  try {
    const lockFileContents = readLockFileContents(packageManager, lockFilePath);
    const lockFileHash = getLockFileHash(lockFileContents);
    // Inconsistent means the lockfile changed between createNodes and
    // createDependencies (e.g. mid-install): ctx.externalNodes reflect the
    // old state, so skip the caches - the next run sees a settled lockfile
    // and reprocesses both phases consistently.
    const consistent = lockFileHash === state.lockFileHash;

    if (consistent) {
      const cachedDependencies = readCachedDependencies(lockFileHash);
      // A cached entry referencing nodes that no longer exist is poisoned
      // (e.g. written by an interrupted process) - reparse instead of
      // failing graph construction with "Source project does not exist".
      if (cachedDependencies?.every((d) => dependencyIsValid(d, ctx))) {
        return cachedDependencies;
      }
    }

    const lockfileDependencies = getLockFileDependencies(
      packageManager,
      lockFileContents,
      lockFileHash,
      ctx,
      state.keyMap
    ).filter((d) => dependencyIsValid(d, ctx));
    if (consistent) {
      writeDependenciesCache(lockFileHash, lockfileDependencies);
    }
    return lockfileDependencies;
  } catch (e) {
    logger.warn(
      `Could not resolve dependencies from ${lockFilePath}. External dependency information may be incomplete until the next run. ${
        e instanceof Error ? e.message : e
      }`
    );
    return [];
  }
}

function dependencyIsValid(
  dep: RawProjectGraphDependency,
  ctx: CreateDependenciesContext
): boolean {
  const exists = (name: string) =>
    !!ctx.externalNodes[name] || !!ctx.projects[name];
  return exists(dep.source) && exists(dep.target);
}

function readLockFileContents(
  packageManager: PackageManager,
  lockFilePath: string
): string {
  return packageManager !== 'bun'
    ? readFileSync(lockFilePath, 'utf-8')
    : readBunLockFile(lockFilePath);
}

function getLockFileHash(lockFileContents: string) {
  return hashArray([nxVersion, lockFileContents]);
}

// Serialize keyMap to JSON-friendly format
function serializeKeyMap(keyMap: Map<string, any>): Record<string, any> {
  const serialized: Record<string, any> = {};
  for (const [key, value] of keyMap.entries()) {
    if (value instanceof Set) {
      // pnpm: Map<string, Set<ProjectGraphExternalNode>>
      serialized[key] = Array.from(value).map((node) => node.name);
    } else if (value && typeof value === 'object' && 'name' in value) {
      // npm/yarn: Map<string, ProjectGraphExternalNode>
      serialized[key] = value.name;
    } else {
      serialized[key] = value;
    }
  }
  return serialized;
}

// Deserialize keyMap from JSON format using ctx.externalNodes
function deserializeKeyMap(
  serialized: Record<string, any>,
  externalNodes: Record<string, ProjectGraphExternalNode>
): Map<string, any> {
  const keyMap = new Map<string, any>();
  for (const [key, value] of Object.entries(serialized)) {
    if (Array.isArray(value)) {
      // pnpm: reconstruct Set<ProjectGraphExternalNode>
      const nodes = value
        .map((nodeName) => externalNodes[nodeName])
        .filter(Boolean);
      keyMap.set(key, new Set(nodes));
    } else if (typeof value === 'string') {
      // npm/yarn: reconstruct ProjectGraphExternalNode
      const node = externalNodes[value];
      if (node) {
        keyMap.set(key, node);
      }
    } else {
      keyMap.set(key, value);
    }
  }
  return keyMap;
}

// On-disk caches. The lockfile hash is embedded in each cache file and
// written in a single atomic write, so a cache entry can never claim to be
// valid for a lockfile state it was not computed from - the failure mode
// behind intermittent "Source project does not exist: npm:<pkg>" errors.
function writeHashedCache(
  cachePath: string,
  legacyHashPath: string,
  hash: string,
  payload: Record<string, unknown>
): void {
  const content = safeStringify({ lockFileHash: hash, ...payload });
  if (content === undefined) {
    logger.warn(`Failed to serialize ${cachePath}. Skipping cache write.`);
    tryRemoveFile(cachePath);
    return;
  }
  safeWriteFileCache(cachePath, content);
  // Older Nx versions trust the legacy hash file and would misread the
  // embedded-hash cache format after a version switch
  tryRemoveFile(legacyHashPath);
}

function readHashedCache(
  cachePath: string,
  expectedHash: string
): Record<string, any> | null {
  try {
    const data = JSON.parse(readFileSync(cachePath, 'utf-8'));
    return data?.lockFileHash === expectedHash ? data : null;
  } catch {
    // Missing, torn, or corrupted cache - reprocess from the lockfile
    return null;
  }
}

function writeExternalNodesCache(
  hash: string,
  nodes: ProjectGraph['externalNodes'],
  keyMap: Map<string, any>
) {
  writeHashedCache(externalNodesCache, legacyExternalNodesHashFile, hash, {
    nodes,
    keyMap: serializeKeyMap(keyMap),
  });
}

function readCachedExternalNodes(expectedHash: string): {
  nodes: ProjectGraph['externalNodes'];
  keyMap: Map<string, any>;
} | null {
  const data = readHashedCache(externalNodesCache, expectedHash);
  if (!data?.nodes || !data.keyMap) {
    return null;
  }
  return {
    nodes: data.nodes,
    keyMap: deserializeKeyMap(data.keyMap, data.nodes),
  };
}

function writeDependenciesCache(
  hash: string,
  dependencies: RawProjectGraphDependency[]
) {
  writeHashedCache(dependenciesCache, legacyDependenciesHashFile, hash, {
    dependencies,
  });
}

function readCachedDependencies(
  expectedHash: string
): RawProjectGraphDependency[] | null {
  const data = readHashedCache(dependenciesCache, expectedHash);
  return Array.isArray(data?.dependencies) ? data.dependencies : null;
}

function safeStringify(data: unknown): string | undefined {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return undefined;
  }
}

// Cache file paths
// Hash-file paths from the pre-embedded-hash cache format; removed on write
// so older Nx versions never pair them with the new cache files
const legacyExternalNodesHashFile = join(
  workspaceDataDirectory,
  'lockfile-nodes.hash'
);
const legacyDependenciesHashFile = join(
  workspaceDataDirectory,
  'lockfile-dependencies.hash'
);
const externalNodesCache = join(
  workspaceDataDirectory,
  'parsed-lock-file.nodes.json'
);
const dependenciesCache = join(
  workspaceDataDirectory,
  'parsed-lock-file.dependencies.json'
);
