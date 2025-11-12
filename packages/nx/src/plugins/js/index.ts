import { execSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { performance } from 'perf_hooks';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph.js';
import { hashArray } from '../../hasher/file-hasher.js';
import {
  CreateDependencies,
  CreateDependenciesContext,
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
} from '../../project-graph/plugins/index.js';
import { RawProjectGraphDependency } from '../../project-graph/project-graph-builder.js';
import { workspaceDataDirectory } from '../../utils/cache-directory.js';
import { combineGlobPatterns } from '../../utils/globs.js';
import { detectPackageManager } from '../../utils/package-manager.js';
import { nxVersion } from '../../utils/versions.js';
import { workspaceRoot } from '../../utils/workspace-root.js';
import { readBunLockFile } from './lock-file/bun-parser.js';
import {
  getLockFileDependencies,
  getLockFileName,
  getLockFileNodes,
  lockFileExists,
  LOCKFILES,
} from './lock-file/lock-file.js';
import { buildExplicitDependencies } from './project-graph/build-dependencies/build-dependencies.js';
import { jsPluginConfig } from './utils/config.js';

export const name = 'nx/js/dependencies-and-lockfile';

// Separate in-memory caches
let cachedExternalNodes: ProjectGraph['externalNodes'] | undefined;
let cachedKeyMap: Map<string, any> | undefined;

export const createNodesV2: CreateNodesV2 = [
  combineGlobPatterns(LOCKFILES),
  (files, _, context) => {
    return createNodesFromFiles(internalCreateNodes, files, _, context);
  },
];

function internalCreateNodes(
  lockFile: string,
  _,
  context: CreateNodesContextV2
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

  const packageManager = detectPackageManager(workspaceRoot);

  let lockfileDependencies: RawProjectGraphDependency[] = [];
  // lockfile may not exist yet
  if (
    pluginConfig.analyzeLockfile &&
    lockFileExists(packageManager) &&
    cachedExternalNodes
  ) {
    const lockFilePath = join(workspaceRoot, getLockFileName(packageManager));
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
        cachedKeyMap
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
  mkdirSync(dirname(externalNodesHashFile), { recursive: true });
  const serializedKeyMap = serializeKeyMap(keyMap);
  const cacheData = { nodes, keyMap: serializedKeyMap };
  writeFileSync(externalNodesCache, JSON.stringify(cacheData, null, 2));
  writeFileSync(externalNodesHashFile, hash);
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
  mkdirSync(dirname(dependenciesHashFile), { recursive: true });
  writeFileSync(dependenciesCache, JSON.stringify(dependencies, null, 2));
  writeFileSync(dependenciesHashFile, hash);
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
