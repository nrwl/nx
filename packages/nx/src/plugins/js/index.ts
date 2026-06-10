import { existsSync, readFileSync, rmSync } from 'fs';
import { dirname, join, relative, sep } from 'path';
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
import { detectPackageManager } from '../../utils/package-manager';
import { safeWriteFileCache } from '../../utils/plugin-cache-utils';
import { nxVersion } from '../../utils/versions';
import { workspaceRoot } from '../../utils/workspace-root';
import { readBunLockFile } from './lock-file/bun-parser';
import {
  findAncestorLockFile,
  getLockFileDependencies,
  getLockFileName,
  getLockFileNodes,
  getLockFilePath,
  lockFileExists,
  LOCKFILES,
} from './lock-file/lock-file';
import { buildExplicitDependencies } from './project-graph/build-dependencies/build-dependencies';
import { jsPluginConfig } from './utils/config';

export const name = 'nx/js/dependencies-and-lockfile';

// Separate in-memory caches
let cachedExternalNodes: ProjectGraph['externalNodes'] | undefined;
let cachedKeyMap: Map<string, any> | undefined;

export const createNodes: CreateNodes = [
  // The root package.json is also matched so external nodes can be created
  // from an ancestor lockfile when the workspace has none of its own (e.g. a
  // nested workspace sharing a parent monorepo's install).
  combineGlobPatterns([...LOCKFILES, 'package.json']),
  (files, _, context) => {
    return createNodesFromFiles(internalCreateNodes, files, _, context);
  },
];

/**
 * The lockfile-relative importer path of this workspace within an ancestor
 * lockfile (e.g. `examples/react/basic` for a nested workspace inside a
 * monorepo).
 */
function getAncestorImporterPath(ancestorLockFilePath: string): string {
  return relative(dirname(ancestorLockFilePath), workspaceRoot)
    .split(sep)
    .join('/');
}

function internalCreateNodes(lockFile: string, _, context: CreateNodesContext) {
  const pluginConfig = jsPluginConfig(context.nxJsonConfiguration);
  if (!pluginConfig.analyzeLockfile) {
    return {};
  }

  // Root package.json trigger: only relevant when the workspace has no
  // lockfile but an ancestor directory does. The package manager is inferred
  // from the ancestor lockfile since local detection cannot see it.
  if (lockFile === 'package.json') {
    const ancestorLockFile = findAncestorLockFile();
    // Ancestor-lockfile derivation is pnpm-only for now: the importer-closure
    // filter that scopes external nodes to this workspace's dependencies is
    // implemented for pnpm's lockfile format.
    if (!ancestorLockFile || ancestorLockFile.packageManager !== 'pnpm') {
      return {};
    }
    const { lockFilePath, packageManager } = ancestorLockFile;
    const importerPath = getAncestorImporterPath(lockFilePath);
    const lockFileContents = readFileSync(lockFilePath, 'utf-8');
    const lockFileHash = getLockFileHash(lockFileContents);

    if (!lockFileNeedsReprocessing(lockFileHash, externalNodesHashFile)) {
      const { nodes, keyMap } = readCachedExternalNodes();
      cachedExternalNodes = nodes;
      cachedKeyMap = keyMap;

      return { externalNodes: nodes };
    }

    const { nodes: externalNodes, keyMap } = getLockFileNodes(
      packageManager,
      lockFileContents,
      lockFileHash,
      context,
      importerPath
    );
    cachedExternalNodes = externalNodes;
    cachedKeyMap = keyMap;

    writeExternalNodesCache(lockFileHash, externalNodes, keyMap);

    return { externalNodes };
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

  if (!lockFileNeedsReprocessing(lockFileHash, externalNodesHashFile)) {
    const { nodes, keyMap } = readCachedExternalNodes();
    cachedExternalNodes = nodes;
    cachedKeyMap = keyMap;

    return {
      externalNodes: nodes,
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

  // When the workspace has no lockfile but an ancestor does (nested workspace
  // sharing a parent monorepo's install), the package manager is inferred from
  // the ancestor lockfile — local detection cannot see it. pnpm-only, matching
  // the createNodes handling.
  const rawAncestorLockFile = findAncestorLockFile();
  const ancestorLockFile =
    rawAncestorLockFile?.packageManager === 'pnpm'
      ? rawAncestorLockFile
      : null;
  const packageManager =
    ancestorLockFile?.packageManager ?? detectPackageManager(workspaceRoot);

  let lockfileDependencies: RawProjectGraphDependency[] = [];
  // lockfile may not exist yet
  if (
    pluginConfig.analyzeLockfile &&
    lockFileExists(packageManager) &&
    cachedExternalNodes
  ) {
    // An ancestor lockfile is used when the workspace has none of its own.
    const lockFilePath =
      ancestorLockFile?.lockFilePath ?? getLockFilePath(packageManager);
    const importerPath = ancestorLockFile
      ? getAncestorImporterPath(ancestorLockFile.lockFilePath)
      : undefined;
    const lockFileContents =
      packageManager !== 'bun'
        ? readFileSync(lockFilePath, 'utf-8')
        : readBunLockFile(lockFilePath);
    const lockFileHash = getLockFileHash(lockFileContents);

    if (!lockFileNeedsReprocessing(lockFileHash, dependenciesHashFile)) {
      lockfileDependencies = readCachedDependencies();
    } else {
      lockfileDependencies = getLockFileDependencies(
        packageManager,
        lockFileContents,
        lockFileHash,
        ctx,
        cachedKeyMap,
        importerPath
      );

      writeDependenciesCache(lockFileHash, lockfileDependencies);
    }
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

function lockFileNeedsReprocessing(lockHash: string, hashFilePath: string) {
  try {
    return readFileSync(hashFilePath).toString() !== lockHash;
  } catch {
    return true;
  }
}

// External nodes cache functions
function writeExternalNodesCache(
  hash: string,
  nodes: ProjectGraph['externalNodes'],
  keyMap: Map<string, any>
) {
  const serializedKeyMap = serializeKeyMap(keyMap);
  const cacheData = { nodes, keyMap: serializedKeyMap };
  const content = safeStringify(cacheData);
  if (content === undefined) {
    logger.warn(
      `Failed to serialize external nodes cache. Skipping cache write.`
    );
    tryRemoveFile(externalNodesCache);
    tryRemoveFile(externalNodesHashFile);
    return;
  }
  safeWriteFileCache(externalNodesCache, content);
  if (existsSync(externalNodesCache)) {
    safeWriteFileCache(externalNodesHashFile, hash);
  }
}

function readCachedExternalNodes(): {
  nodes: ProjectGraph['externalNodes'];
  keyMap: Map<string, any>;
} {
  const { nodes, keyMap } = JSON.parse(
    readFileSync(externalNodesCache, 'utf-8')
  );
  return { nodes, keyMap: deserializeKeyMap(keyMap, nodes) };
}

// Dependencies cache functions
function writeDependenciesCache(
  hash: string,
  dependencies: RawProjectGraphDependency[]
) {
  const content = safeStringify(dependencies);
  if (content === undefined) {
    logger.warn(
      `Failed to serialize dependencies cache. Skipping cache write.`
    );
    tryRemoveFile(dependenciesCache);
    tryRemoveFile(dependenciesHashFile);
    return;
  }
  safeWriteFileCache(dependenciesCache, content);
  if (existsSync(dependenciesCache)) {
    safeWriteFileCache(dependenciesHashFile, hash);
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

function readCachedDependencies(): RawProjectGraphDependency[] {
  return JSON.parse(readFileSync(dependenciesCache).toString());
}

// Cache file paths
const externalNodesHashFile = join(
  workspaceDataDirectory,
  'lockfile-nodes.hash'
);
const dependenciesHashFile = join(
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
