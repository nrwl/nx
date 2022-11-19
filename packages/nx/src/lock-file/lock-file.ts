import { readFileSync, writeFileSync } from 'fs-extra';
import { detectPackageManager, PackageManager } from '../utils/package-manager';
import {
  parseYarnLockFile,
  pruneYarnLockFile,
  stringifyYarnLockFile,
  transitiveDependencyYarnLookup,
} from './yarn';
import {
  parseNpmLockFile,
  pruneNpmLockFile,
  stringifyNpmLockFile,
  transitiveDependencyNpmLookup,
} from './npm';
import {
  parsePnpmLockFile,
  prunePnpmLockFile,
  stringifyPnpmLockFile,
  transitiveDependencyPnpmLookup,
} from './pnpm';
import { LockFileData } from './lock-file-type';
import { workspaceRoot } from '../utils/workspace-root';
import { join } from 'path';
import { hashExternalNodes, hashString, mapExternalNodes } from './utils';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../config/project-graph';
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
  lockFileData: LockFileData,
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): ProjectGraph {
  let externalNodes;

  if (packageManager === 'yarn') {
    externalNodes = mapExternalNodes(
      lockFileData,
      transitiveDependencyYarnLookup
    );
  }
  if (packageManager === 'pnpm') {
    externalNodes = mapExternalNodes(
      lockFileData,
      transitiveDependencyPnpmLookup
    );
  }
  if (packageManager === 'npm') {
    externalNodes = mapExternalNodes(
      lockFileData,
      transitiveDependencyNpmLookup
    );
  }
  if (externalNodes) {
    hashExternalNodes(externalNodes);
    return externalNodes;
  }
  throw Error(`Unknown package manager: ${packageManager}`);
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
  projectName?: string,
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): LockFileData {
  if (packageManager === 'yarn') {
    return pruneYarnLockFile(lockFile, packages, projectName);
  }
  if (packageManager === 'pnpm') {
    return prunePnpmLockFile(lockFile, packages, projectName);
  }
  if (packageManager === 'npm') {
    return pruneNpmLockFile(lockFile, packages, projectName);
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}
