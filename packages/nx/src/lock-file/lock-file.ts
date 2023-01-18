import { readFileSync } from 'fs-extra';
import { detectPackageManager, PackageManager } from '../utils/package-manager';

import { parseNpmLockFile, pruneNpmLockFile } from './npm-parser';
import { parsePnpmLockfile, stringifyPnpmLockfile } from './pnpm-parser';
import { parseYarnLockFile, pruneYarnLockFile } from './yarn-parser';

import { workspaceRoot } from '../utils/workspace-root';
import { ProjectGraph } from '../config/project-graph';
import { join } from 'path';
import { existsSync } from 'fs';
import { normalizePackageJson } from './utils/pruning-utils';
import { PackageJson } from '../utils/package-json';
import { readJsonFile } from '../utils/fileutils';
import { LockFileGraph } from './utils/types';
import { defaultHashing } from '../hasher/hashing-impl';
import { mapLockFileGraphToProjectGraph } from './lock-file-graph-mapper';

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
  throw new Error(
    `Unknown package manager ${packageManager} or lock file missing`
  );
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
    throw new Error(
      `Unknown package manager ${packageManager} or lock file missing`
    );
  }
}

/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileGraph}
 */
export function parseLockFile(
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): ProjectGraph {
  const packageJson = readJsonFile(join(workspaceRoot, 'package.json'));
  if (packageManager === 'yarn') {
    const content = readFileSync(YARN_LOCK_PATH, 'utf8');
    return mapLockFileGraphToProjectGraph(
      parseYarnLockFile(content, packageJson)
    );
  }
  if (packageManager === 'pnpm') {
    const content = readFileSync(PNPM_LOCK_PATH, 'utf8');
    return parsePnpmLockfile(content);
  }
  if (packageManager === 'npm') {
    const content = readFileSync(NPM_LOCK_PATH, 'utf8');
    return mapLockFileGraphToProjectGraph(
      parseNpmLockFile(content, packageJson)
    );
  }
  throw new Error(`Unknown package manager: ${packageManager}`);
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
  throw new Error(`Unknown package manager: ${packageManager}`);
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
    const prunedGraph = parsePnpmLockfile(content);
    return stringifyPnpmLockfile(prunedGraph, content, normalizedPackageJson);
  }
  if (packageManager === 'npm') {
    const content = readFileSync(NPM_LOCK_FILE, 'utf8');
    return pruneNpmLockFile(content, rootPackageJson, normalizedPackageJson);
  }
  throw new Error(`Unknown package manager: ${packageManager}`);
}

function hashString(fileContent: string): string {
  return defaultHashing.hashArray([fileContent]);
}
