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

/**
 * Hashes lock file content
 */
export function lockFileHash(
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): string {
  let file: string;
  if (packageManager === 'yarn') {
    file = readFileSync(join(workspaceRoot, 'yarn.lock'), 'utf8');
  }
  if (packageManager === 'pnpm') {
    file = readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8');
  }
  if (packageManager === 'npm') {
    file = readFileSync(join(workspaceRoot, 'package-lock.json'), 'utf8');
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
    const file = readFileSync(join(workspaceRoot, 'yarn.lock'), 'utf8');
    return parseYarnLockFile(file);
  }
  if (packageManager === 'pnpm') {
    const file = readFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), 'utf8');
    return parsePnpmLockFile(file);
  }
  if (packageManager === 'npm') {
    const file = readFileSync(join(workspaceRoot, 'package-lock.json'), 'utf8');
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
  Object.keys(lockFileData.dependencies).forEach((dep) => {
    Object.keys(lockFileData.dependencies[dep]).forEach((version, index) => {
      const nodeName: `npm:${string}` = !index
        ? `npm:${dep}`
        : `npm:${dep}@${version}`;
      const packageVersion = lockFileData.dependencies[dep][version];

      // map packages' transitive dependencies and peer dependencies to external nodes' versions
      const dependencies = mapTransitiveDependencies(
        lockFileData.dependencies,
        packageVersion.dependencies
      );
      const peerDependencies = mapTransitiveDependencies(
        lockFileData.dependencies,
        packageVersion.peerDependencies
      );

      // save external node
      result[nodeName] = {
        type: 'npm',
        name: nodeName,
        data: {
          version: packageVersion.version,
          packageName: dep,
          ...(dependencies && { dependencies }),
          ...(peerDependencies && { peerDependencies }),
        },
      };
    });
  });
  return result;
}

// Finds the maching version of each dependency of the package and
// maps each {package}:{versionRange} pair to {package}:[{versionRange}, {version}]
function mapTransitiveDependencies(
  packages: Record<string, PackageVersions>,
  dependencies: Record<string, string>
): Record<string, [string, string]> {
  if (!dependencies) {
    return undefined;
  }
  const result: Record<string, [string, string]> = {};

  Object.keys(dependencies).forEach((packageName) => {
    const version = findMatchingVersion(
      packages[packageName],
      dependencies[packageName]
    );
    result[packageName] = [
      dependencies[packageName],
      version || dependencies[packageName],
    ];
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
    writeFileSync(join(workspaceRoot, 'yarn.lock'), content);
    return;
  }
  if (packageManager === 'pnpm') {
    const content = stringifyPnpmLockFile(lockFile);
    writeFileSync(join(workspaceRoot, 'pnpm-lock.yaml'), content);
    return;
  }
  if (packageManager === 'npm') {
    const content = stringifyNpmLockFile(lockFile);
    writeFileSync(join(workspaceRoot, 'package-lock.json'), content);
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
