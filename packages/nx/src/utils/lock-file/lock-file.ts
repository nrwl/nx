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
import { ProjectGraphExternalNode } from '../../config/project-graph';
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
export function mapLockFileDataToExternalNodes(
  lockFileData: LockFileData
): Record<string, ProjectGraphExternalNode> {
  const result: Record<string, ProjectGraphExternalNode> = {};
  const versionCache: Record<string, string> = {};

  Object.keys(lockFileData.dependencies).forEach((dep) => {
    const versions = lockFileData.dependencies[dep];
    Object.keys(versions).forEach((nameVersion, index) => {
      const packageVersion = versions[nameVersion];

      // map packages' transitive dependencies and peer dependencies to external nodes' versions
      const dependencies = mapTransitiveDependencies(
        lockFileData.dependencies,
        packageVersion.dependencies,
        versionCache
      );
      const peerDependencies = mapTransitiveDependencies(
        lockFileData.dependencies,
        packageVersion.peerDependencies,
        versionCache
      );

      // save external node
      const nodeName: `npm:${string}` = !index
        ? `npm:${dep}`
        : `npm:${nameVersion}`;
      result[nodeName] = {
        type: 'npm',
        name: nodeName,
        data: {
          version: packageVersion.version,
          packageName: dep,
        },
      };
      if (dependencies) {
        result[nodeName].data.dependencies = dependencies;
      }
      if (peerDependencies) {
        result[nodeName].data.peerDependencies = peerDependencies;
      }
    });
  });
  return result;
}

// Finds the maching version of each dependency of the package and
// maps each {package}:{versionRange} pair to {package}:[{versionRange}, {version}]
function mapTransitiveDependencies(
  packages: Record<string, PackageVersions>,
  dependencies: Record<string, string>,
  versionCache: Record<string, string>
): Record<string, [string, string]> {
  if (!dependencies) {
    return undefined;
  }
  const result: Record<string, [string, string]> = {};

  Object.keys(dependencies).forEach((packageName) => {
    const key = `${packageName}@${dependencies[packageName]}`;

    // some of the peer dependencies might not be installed,
    // we don't need them as nodes in externalNodes
    if (!packages[packageName]) {
      result[packageName] = [dependencies[packageName], undefined];
      versionCache[key] = undefined;
      return;
    }

    // if we already processed this dependency, use the version from the cache
    if (versionCache[key]) {
      result[packageName] = [dependencies[packageName], versionCache[key]];
    } else {
      const version =
        findMatchingVersion(
          packageName,
          packages[packageName],
          dependencies[packageName]
        ) || dependencies[packageName];
      result[packageName] = [dependencies[packageName], version];
      versionCache[key] = version;
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
