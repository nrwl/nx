import { readFileSync, writeFileSync } from 'fs-extra';
import { detectPackageManager, PackageManager } from '../package-manager';
import {
  parseYarnLockFile,
  pruneYarnLockFile,
  stringifyYarnLockFile,
} from './yarn';
import {
  parseNpmLockFile,
  pruneNpmLockFile,
  stringifyNpmLockFile,
} from './npm';
import {
  parsePnpmLockFile,
  prunePnpmLockFile,
  stringifyPnpmLockFile,
} from './pnpm';
import { LockFileData, PackageVersions } from './lock-file-type';
import { workspaceRoot } from '../workspace-root';
import { join } from 'path';
import { findMatchingVersion, hashString } from './utils';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../config/project-graph';
import { existsSync } from 'fs';

const YARN_LOCK_PATH = join(workspaceRoot, 'yarn.lock');
const NPM_LOCK_PATH = join(workspaceRoot, 'package-lock.json');
const PNPM_LOCK_PATH = join(workspaceRoot, 'pnpm-lock.yaml');

/**
 * Check if lock file exists
 */
export function lockFileExists(
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): boolean {
  if (packageManager === 'yarn') {
    return existsSync(YARN_LOCK_PATH);
  }
  if (packageManager === 'pnpm') {
    return existsSync(PNPM_LOCK_PATH);
  }
  if (packageManager === 'npm') {
    return existsSync(NPM_LOCK_PATH);
  }
  throw Error(`Unknown package manager ${packageManager} or lock file missing`);
}

/**
 * Hashes lock file content
 */
export function lockFileHash(
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): string {
  let file: string;
  if (packageManager === 'yarn') {
    file = readFileSync(YARN_LOCK_PATH, 'utf8');
  }
  if (packageManager === 'pnpm') {
    file = readFileSync(PNPM_LOCK_PATH, 'utf8');
  }
  if (packageManager === 'npm') {
    file = readFileSync(NPM_LOCK_PATH, 'utf8');
  }
  if (file) {
    return hashString(file);
  } else {
    throw Error(
      `Unknown package manager ${packageManager} or lock file missing`
    );
  }
}

/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileData}
 */
export function parseLockFile(
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): LockFileData {
  if (packageManager === 'yarn') {
    const file = readFileSync(YARN_LOCK_PATH, 'utf8');
    return parseYarnLockFile(file);
  }
  if (packageManager === 'pnpm') {
    const file = readFileSync(PNPM_LOCK_PATH, 'utf8');
    return parsePnpmLockFile(file);
  }
  if (packageManager === 'npm') {
    const file = readFileSync(NPM_LOCK_PATH, 'utf8');
    return parseNpmLockFile(file);
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}

/**
 * Maps lock file data to {@link ProjectGraphExternalNode} hash map
 * @param lockFileData
 * @returns
 */
export function mapLockFileDataToPartialGraph(
  lockFileData: LockFileData
): ProjectGraph {
  const result: ProjectGraph = {
    dependencies: {},
    externalNodes: {},
    nodes: {},
  };
  const versionCache: Record<string, string> = {};

  Object.keys(lockFileData.dependencies).forEach((dep) => {
    const versions = lockFileData.dependencies[dep];
    Object.keys(versions).forEach((nameVersion) => {
      const packageVersion = versions[nameVersion];

      // map packages' transitive dependencies and peer dependencies to external nodes' versions
      const combinedDependencies =
        packageVersion.dependencies || packageVersion.peerDependencies
          ? {
              ...(packageVersion.dependencies || {}),
              ...(packageVersion.peerDependencies || {}),
            }
          : undefined;

      const dependencies = mapTransitiveDependencies(
        lockFileData.dependencies,
        combinedDependencies,
        versionCache
      );

      // save external node
      const nodeName = getNodeName(
        dep,
        packageVersion.version,
        packageVersion.rootVersion
      );
      result.externalNodes[nodeName] = {
        type: 'npm',
        name: nodeName,
        data: {
          version: packageVersion.version,
          packageName: dep,
        },
      };

      // map transitive dependencies to dependencies hash map
      dependencies.forEach((dep) => {
        result.dependencies[nodeName] = result.dependencies[nodeName] || [];
        result.dependencies[nodeName].push({
          type: 'static',
          source: nodeName,
          target: dep,
        });
      });
    });
  });
  return result;
}

function getNodeName(
  dep: string,
  version: string,
  rootVersion: boolean
): `npm:${string}` {
  return rootVersion ? `npm:${dep}` : `npm:${dep}@${version}`;
}

// Finds the maching version of each dependency of the package and
// maps each {package}:{versionRange} pair to "npm:{package}@{version}"
function mapTransitiveDependencies(
  packages: Record<string, PackageVersions>,
  dependencies: Record<string, string>,
  versionCache: Record<string, string>
): string[] {
  if (!dependencies) {
    return [];
  }
  const result: string[] = [];

  Object.keys(dependencies).forEach((packageName) => {
    const key = `${packageName}@${dependencies[packageName]}`;

    // some of the peer dependencies might not be installed,
    // we don't have them as nodes in externalNodes
    // so there's no need to map them as dependencies
    if (!packages[packageName]) {
      return;
    }

    // if we already processed this dependency, use the version from the cache
    if (versionCache[key]) {
      result.push(versionCache[key]);
    } else {
      const versions = packages[packageName];
      const version =
        findMatchingVersion(packageName, versions, dependencies[packageName]) ||
        dependencies[packageName];
      const nodeName = getNodeName(
        packageName,
        version,
        versions[version]?.rootVersion
      );
      result.push(nodeName);
      versionCache[key] = nodeName;
    }
  });

  return result;
}

/**
 * Stringifies {@link LockFileData} content and writes it to lock file
 */
export function writeLockFile(
  lockFile: LockFileData,
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): void {
  if (packageManager === 'yarn') {
    const content = stringifyYarnLockFile(lockFile);
    writeFileSync(YARN_LOCK_PATH, content);
    return;
  }
  if (packageManager === 'pnpm') {
    const content = stringifyPnpmLockFile(lockFile);
    writeFileSync(PNPM_LOCK_PATH, content);
    return;
  }
  if (packageManager === 'npm') {
    const content = stringifyNpmLockFile(lockFile);
    writeFileSync(NPM_LOCK_PATH, content);
    return;
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}

/**
 * Prunes {@link LockFileData} based on minimal necessary set of packages
 * Returns new {@link LockFileData}
 */
export function pruneLockFile(
  lockFile: LockFileData,
  packages: string[],
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): LockFileData {
  if (packageManager === 'yarn') {
    return pruneYarnLockFile(lockFile, packages);
  }
  if (packageManager === 'pnpm') {
    return prunePnpmLockFile(lockFile, packages);
  }
  if (packageManager === 'npm') {
    return pruneNpmLockFile(lockFile, packages);
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}
