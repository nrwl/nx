import { readFileSync } from 'fs-extra';
import { detectPackageManager, PackageManager } from '../utils/package-manager';

import { parseNpmLockFile, pruneNpmLockFile } from './npm-v2';
import { parsePnpmLockFile, prunePnpmLockFile } from './pnpm-v2';
import { parseYarnLockFile, pruneYarnLockFile } from './yarn-v2';

import { workspaceRoot } from '../utils/workspace-root';
import { join } from 'path';
import { existsSync } from 'fs';
import { normalizePackageJson } from './utils/pruning';
import { PackageJson } from '../utils/package-json';
import { readJsonFile } from '../utils/fileutils';
import { LockFileGraph } from './utils/types';
import { defaultHashing } from '../hasher/hashing-impl';

const YARN_LOCK_FILE = 'yarn.lock';
const NPM_LOCK_FILE = 'package-lock.json';
const PNPM_LOCK_FILE = 'pnpm-lock.yaml';

const YARN_LOCK_PATH = join(workspaceRoot, YARN_LOCK_FILE);
const NPM_LOCK_PATH = join(workspaceRoot, NPM_LOCK_FILE);
const PNPM_LOCK_PATH = join(workspaceRoot, PNPM_LOCK_FILE);

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
 * Parses lock file and maps dependencies and metadata to {@link LockFileGraph}
 */
export function parseLockFile(
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): LockFileGraph {
  const packageJson = readJsonFile(join(workspaceRoot, 'package.json'));
  if (packageManager === 'yarn') {
    const content = readFileSync(YARN_LOCK_PATH, 'utf8');
    return parseYarnLockFile(content, packageJson);
  }
  if (packageManager === 'pnpm') {
    const content = readFileSync(PNPM_LOCK_PATH, 'utf8');
    return parsePnpmLockFile(content);
  }
  if (packageManager === 'npm') {
    const content = readFileSync(NPM_LOCK_PATH, 'utf8');
    return parseNpmLockFile(content, packageJson);
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}

/**
 * Returns lock file name based on the detected package manager in the root
 * @param packageManager
 * @returns
 */
export function getLockFileName(
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): string {
  if (packageManager === 'yarn') {
    return YARN_LOCK_FILE;
  }
  if (packageManager === 'pnpm') {
    return PNPM_LOCK_FILE;
  }
  if (packageManager === 'npm') {
    return NPM_LOCK_FILE;
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}

/**
 * Create lock file based on the root level lock file and (pruned) package.json
 *
 * @param packageJson
 * @param isProduction
 * @param packageManager
 * @returns
 */
export function createLockFile(
  packageJson: PackageJson,
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): string {
  const rootPackageJson = readJsonFile(join(workspaceRoot, 'package.json'));
  const normalizedPackageJson = normalizePackageJson(packageJson);

  if (packageManager === 'yarn') {
    const content = readFileSync(YARN_LOCK_PATH, 'utf8');
    return pruneYarnLockFile(content, rootPackageJson, normalizedPackageJson);
  }
  if (packageManager === 'pnpm') {
    const content = readFileSync(PNPM_LOCK_FILE, 'utf8');
    return prunePnpmLockFile(content, normalizedPackageJson);
  }
  if (packageManager === 'npm') {
    const content = readFileSync(NPM_LOCK_FILE, 'utf8');
    return pruneNpmLockFile(content, rootPackageJson, normalizedPackageJson);
  }
  throw Error(`Unknown package manager: ${packageManager}`);
}

function hashString(fileContent: string): string {
  return defaultHashing.hashArray([fileContent]);
}
