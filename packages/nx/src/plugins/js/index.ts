import { existsSync, rmSync } from 'fs';
import { performance } from 'perf_hooks';
import { ProjectGraphExternalNode } from '../../config/project-graph';
import { hashArray } from '../../hasher/file-hasher';
import {
  CreateDependencies,
  CreateDependenciesContext,
  CreateNodes,
  CreateNodesContext,
  createNodesFromFiles,
} from '../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../project-graph/project-graph-builder';
import { combineGlobPatterns } from '../../utils/globs';
import { logger } from '../../utils/logger';
import { detectPackageManager } from '../../utils/package-manager';
import { safeWriteFileCache } from '../../utils/plugin-cache-utils';
import { workspaceRoot } from '../../utils/workspace-root';
import {
  getLockFileDependencies,
  getLockFileName,
  getLockFileNodes,
  lockFileExists,
  LOCKFILES,
} from './lock-file/lock-file';
import {
  dependenciesCache,
  externalNodesCache,
  readCache,
  readCachedExternalNodes,
  readLockFile,
  type LockFileContents,
} from './lock-file/lock-file-snapshot';
import { foldLocalPathHashes } from './lock-file/utils/local-path-hashes';
import { getExternalNodes } from './lock-file/project-graph-pruning';
import { buildExplicitDependencies } from './project-graph/build-dependencies/build-dependencies';
import { jsPluginConfig } from './utils/config';

export const name = 'nx/js/dependencies-and-lockfile';

// An install can rewrite the lockfile between createNodes and
// createDependencies, so both parse the one createNodes read.
let cachedLockFile: LockFileContents | undefined;
let cachedKeyMap: Map<string, any> | undefined;
let cachedInstalledLocalPathNodes:
  | Record<string, Record<string, string>>
  | undefined;

export const createNodes: CreateNodes = [
  combineGlobPatterns(LOCKFILES),
  (files, _, context) => {
    // A long-lived process must not reuse a lockfile this computation skipped.
    cachedLockFile = undefined;
    cachedKeyMap = undefined;
    cachedInstalledLocalPathNodes = undefined;
    return createNodesFromFiles(internalCreateNodes, files, _, context);
  },
];

async function internalCreateNodes(
  lockFile: string,
  _: unknown,
  context: CreateNodesContext
) {
  const pluginConfig = jsPluginConfig(context.nxJsonConfiguration);
  if (!pluginConfig.analyzeLockfile) {
    return {};
  }

  const packageManager = detectPackageManager(workspaceRoot);

  // Only process the correct lockfile
  if (lockFile !== getLockFileName(packageManager)) {
    return {};
  }

  cachedLockFile = readLockFile(workspaceRoot, packageManager, lockFile);
  const { lockFileContents, lockFileHash, bunPatchFileHashes } = cachedLockFile;

  const cached = readCachedExternalNodes(lockFileHash);
  if (cached) {
    cachedKeyMap = deserializeKeyMap(cached.keyMap, cached.nodes);
    cachedInstalledLocalPathNodes = cached.installedLocalPathNodes;

    return {
      externalNodes: await foldLocalPathHashes(
        cached.nodes,
        cached.localPathSources ?? {},
        workspaceRoot
      ),
    };
  }

  const {
    nodes: externalNodes,
    keyMap,
    localPathSources = {},
    installedLocalPathNodes,
  } = getLockFileNodes(
    packageManager,
    lockFile,
    lockFileContents,
    lockFileHash,
    context,
    bunPatchFileHashes
  );
  cachedKeyMap = keyMap;
  cachedInstalledLocalPathNodes = installedLocalPathNodes;

  writeCache(externalNodesCache, lockFileHash, {
    nodes: externalNodes,
    keyMap: serializeKeyMap(keyMap),
    localPathSources,
    installedLocalPathNodes,
  });

  return {
    externalNodes: await foldLocalPathHashes(
      externalNodes,
      localPathSources,
      workspaceRoot
    ),
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
    cachedKeyMap &&
    lockFileExists(cachedLockFile.packageManager)
  ) {
    const { packageManager, lockFile, lockFileContents, lockFileHash } =
      cachedLockFile;
    // Cached dependencies name their external nodes, and those names also
    // depend on node_modules hoisting.
    const dependenciesHash = hashArray([
      lockFileHash,
      ...Object.keys(getExternalNodes(ctx)),
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
    ctx,
    cachedInstalledLocalPathNodes
  );
  performance.mark('build typescript dependencies - end');
  performance.measure(
    'build typescript dependencies',
    'build typescript dependencies - start',
    'build typescript dependencies - end'
  );
  return lockfileDependencies.concat(explicitProjectDependencies);
};

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
