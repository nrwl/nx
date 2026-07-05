import { existsSync, readFileSync, rmSync } from 'fs';
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
import { safeWriteFileCache } from '../../utils/plugin-cache-utils';
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

// Separate in-memory caches
let cachedExternalNodes: ProjectGraph['externalNodes'] | undefined;
let cachedKeyMap: Map<string, any> | undefined;
// Hash of the lockfile the in-memory nodes/keyMap were derived from. The
// dependencies cache is only trusted when it matches this hash, so nodes and
// dependencies always come from the same lockfile state.
let cachedNodesLockFileHash: string | undefined;

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
  const lockFileContents =
    packageManager !== 'bun'
      ? readFileSync(lockFilePath, 'utf-8')
      : readBunLockFile(lockFilePath);
  const lockFileHash = getLockFileHash(lockFileContents);

  const cached = readCachedExternalNodes(lockFileHash);
  if (cached) {
    cachedExternalNodes = cached.nodes;
    cachedKeyMap = cached.keyMap;
    cachedNodesLockFileHash = lockFileHash;

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
  cachedExternalNodes = externalNodes;
  cachedKeyMap = keyMap;
  cachedNodesLockFileHash = lockFileHash;

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
    cachedExternalNodes
  ) {
    lockfileDependencies = getLockfileDependenciesSafely(packageManager, ctx);
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
 * currently in memory. Never throws: any inconsistency falls back to
 * reparsing, and a failed parse degrades to "no lockfile dependencies for
 * this run" instead of failing the whole project graph.
 */
function getLockfileDependenciesSafely(
  packageManager: PackageManager,
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  const lockFilePath = join(workspaceRoot, getLockFileName(packageManager));
  try {
    const lockFileContents =
      packageManager !== 'bun'
        ? readFileSync(lockFilePath, 'utf-8')
        : readBunLockFile(lockFilePath);
    const lockFileHash = getLockFileHash(lockFileContents);

    if (lockFileHash === cachedNodesLockFileHash) {
      const cachedDependencies = readCachedDependencies(lockFileHash);
      // A cached entry referencing nodes that no longer exist is poisoned
      // (e.g. written by an interrupted process) - reparse instead of
      // failing graph construction with "Source project does not exist".
      if (cachedDependencies && dependenciesAreValid(cachedDependencies, ctx)) {
        return cachedDependencies;
      }

      const lockfileDependencies = getLockFileDependencies(
        packageManager,
        lockFileContents,
        lockFileHash,
        ctx,
        cachedKeyMap
      );
      writeDependenciesCache(lockFileHash, lockfileDependencies);
      return lockfileDependencies;
    }

    // The lockfile changed between createNodes and createDependencies (e.g.
    // mid-install). ctx.externalNodes reflect the old state, so drop edges
    // that no longer line up and skip the cache write - the next run sees a
    // settled lockfile and reprocesses both phases consistently.
    const lockfileDependencies = getLockFileDependencies(
      packageManager,
      lockFileContents,
      lockFileHash,
      ctx,
      cachedKeyMap
    );
    return lockfileDependencies.filter((d) => dependencyIsValid(d, ctx));
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

function dependenciesAreValid(
  deps: RawProjectGraphDependency[],
  ctx: CreateDependenciesContext
): boolean {
  return deps.every((d) => dependencyIsValid(d, ctx));
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

// External nodes cache functions.
// The lockfile hash is embedded in the cache file (single atomic write) so a
// cache entry can never claim to be valid for a lockfile state it was not
// computed from - the failure mode behind intermittent
// "Source project does not exist: npm:<pkg>" errors.
function writeExternalNodesCache(
  hash: string,
  nodes: ProjectGraph['externalNodes'],
  keyMap: Map<string, any>
) {
  const serializedKeyMap = serializeKeyMap(keyMap);
  const cacheData = { lockFileHash: hash, nodes, keyMap: serializedKeyMap };
  const content = safeStringify(cacheData);
  if (content === undefined) {
    logger.warn(
      `Failed to serialize external nodes cache. Skipping cache write.`
    );
    tryRemoveFile(externalNodesCache);
    return;
  }
  safeWriteFileCache(externalNodesCache, content);
  // Older Nx versions trust this hash file and would misread the new
  // embedded-hash cache format after a version switch
  tryRemoveFile(legacyExternalNodesHashFile);
}

function readCachedExternalNodes(expectedHash: string): {
  nodes: ProjectGraph['externalNodes'];
  keyMap: Map<string, any>;
} | null {
  try {
    const { lockFileHash, nodes, keyMap } = JSON.parse(
      readFileSync(externalNodesCache, 'utf-8')
    );
    if (lockFileHash !== expectedHash || !nodes || !keyMap) {
      return null;
    }
    return { nodes, keyMap: deserializeKeyMap(keyMap, nodes) };
  } catch {
    // Missing, torn, or corrupted cache - reprocess from the lockfile
    return null;
  }
}

// Dependencies cache functions
function writeDependenciesCache(
  hash: string,
  dependencies: RawProjectGraphDependency[]
) {
  const content = safeStringify({ lockFileHash: hash, dependencies });
  if (content === undefined) {
    logger.warn(
      `Failed to serialize dependencies cache. Skipping cache write.`
    );
    tryRemoveFile(dependenciesCache);
    return;
  }
  safeWriteFileCache(dependenciesCache, content);
  // Older Nx versions trust this hash file and would misread the new
  // embedded-hash cache format after a version switch
  tryRemoveFile(legacyDependenciesHashFile);
}

function readCachedDependencies(
  expectedHash: string
): RawProjectGraphDependency[] | null {
  try {
    const { lockFileHash, dependencies } = JSON.parse(
      readFileSync(dependenciesCache, 'utf-8')
    );
    if (lockFileHash !== expectedHash || !Array.isArray(dependencies)) {
      return null;
    }
    return dependencies;
  } catch {
    // Missing, torn, or corrupted cache - reprocess from the lockfile
    return null;
  }
}

function safeStringify(data: unknown): string | undefined {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return undefined;
  }
}

function tryRemoveFile(path: string): void {
  try {
    if (existsSync(path)) {
      rmSync(path);
    }
  } catch {
    // Best effort
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
