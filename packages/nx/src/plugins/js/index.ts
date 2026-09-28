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
  type PackageManager,
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

// An install can rewrite the lockfile between createNodes and
// createDependencies, so both parse the one createNodes read.
let cachedLockFile:
  | {
      packageManager: PackageManager;
      lockFile: string;
      lockFileContents: string;
      lockFileHash: string;
    }
  | undefined;
let cachedKeyMap: Map<string, any> | undefined;

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
  cachedLockFile = { packageManager, lockFile, lockFileContents, lockFileHash };

  const cached = readCache<ExternalNodesCache>(
    externalNodesCache,
    lockFileHash
  );
  if (cached) {
    cachedKeyMap = deserializeKeyMap(cached.keyMap, cached.nodes);

    return {
      externalNodes: cached.nodes,
    };
  }

  const { nodes: externalNodes, keyMap } = getLockFileNodes(
    packageManager,
    lockFile,
    lockFileContents,
    lockFileHash,
    context
  );
  cachedKeyMap = keyMap;

  writeCache(externalNodesCache, lockFileHash, {
    nodes: externalNodes,
    keyMap: serializeKeyMap(keyMap),
  });

  return {
    externalNodes,
  };
}

export const createDependencies: CreateDependencies = (
  _,
  ctx: CreateDependenciesContext
) => {
  const pluginConfig = jsPluginConfig(ctx.nxJsonConfiguration);

  let lockfileDependencies: RawProjectGraphDependency[] = [];
  // lockfile may not exist yet
  if (
    pluginConfig.analyzeLockfile &&
    cachedLockFile &&
    lockFileExists(cachedLockFile.packageManager)
  ) {
    const { packageManager, lockFile, lockFileContents, lockFileHash } =
      cachedLockFile;
    // Cached dependencies name their external nodes, and those names also
    // depend on node_modules hoisting.
    const dependenciesHash = hashArray([
      lockFileHash,
      ...Object.keys(ctx.externalNodes),
    ]);

    const cachedDependencies = readCache<RawProjectGraphDependency[]>(
      dependenciesCache,
      dependenciesHash
    );
    if (cachedDependencies) {
      lockfileDependencies = cachedDependencies;
    } else {
      lockfileDependencies = getLockFileDependencies(
        packageManager,
        lockFile,
        lockFileContents,
        lockFileHash,
        ctx,
        cachedKeyMap
      );

      writeCache(dependenciesCache, dependenciesHash, lockfileDependencies);
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

// Deserialize keyMap from JSON format
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

interface ExternalNodesCache {
  nodes: ProjectGraph['externalNodes'];
  keyMap: Record<string, any>;
}

function readCache<T>(path: string, key: string): T | undefined {
  try {
    const cache = JSON.parse(readFileSync(path, 'utf-8'));
    return cache.key === key ? cache.data : undefined;
  } catch {
    // Another process can be mid-write, so an unreadable cache is a miss.
    return undefined;
  }
}

function writeCache(path: string, key: string, data: unknown) {
  const content = safeStringify({ key, data });
  if (content === undefined) {
    logger.warn(`Failed to serialize ${path}. Skipping cache write.`);
    tryRemoveFile(path);
    return;
  }
  safeWriteFileCache(path, content);
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

// Each cache file holds its key, so key and data come from one write.
// Older Nx versions read other names with a hash file; keep these distinct.
const externalNodesCache = join(workspaceDataDirectory, 'lockfile-nodes.json');
const dependenciesCache = join(
  workspaceDataDirectory,
  'lockfile-dependencies.json'
);
