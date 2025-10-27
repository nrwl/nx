import { execSync } from 'child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { performance } from 'perf_hooks';
import { ProjectGraph } from '../../config/project-graph';
import { hashArray } from '../../hasher/file-hasher';
import {
  CreateDependencies,
  CreateDependenciesContext,
  CreateNodesContextV2,
  createNodesFromFiles,
  CreateNodesV2,
} from '../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../project-graph/project-graph-builder';
import { workspaceDataDirectory } from '../../utils/cache-directory';
import { combineGlobPatterns } from '../../utils/globs';
import { detectPackageManager } from '../../utils/package-manager';
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
    const nodes = readCachedExternalNodes();
    cachedExternalNodes = nodes;

    return {
      externalNodes: nodes,
    };
  }

  const externalNodes = getLockFileNodes(
    packageManager,
    lockFileContents,
    lockFileHash,
    context
  );
  cachedExternalNodes = externalNodes;

  writeExternalNodesCache(lockFileHash, externalNodes);

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
        ctx
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
  nodes: ProjectGraph['externalNodes']
) {
  mkdirSync(dirname(externalNodesHashFile), { recursive: true });
  writeFileSync(externalNodesCache, JSON.stringify(nodes, null, 2));
  writeFileSync(externalNodesHashFile, hash);
}

function readCachedExternalNodes(): ProjectGraph['externalNodes'] {
  return JSON.parse(readFileSync(externalNodesCache).toString());
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
