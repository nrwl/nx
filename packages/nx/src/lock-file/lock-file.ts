import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { detectPackageManager, PackageManager } from '../utils/package-manager';
import { workspaceRoot } from '../utils/workspace-root';
import { ProjectGraph } from '../config/project-graph';
import { PackageJson } from '../utils/package-json';
import { defaultHashing } from '../hasher/hashing-impl';

import { parseNpmLockfile, stringifyNpmLockfile } from './npm-parser';
import { parsePnpmLockfile, stringifyPnpmLockfile } from './pnpm-parser';
import { parseYarnLockfile, stringifyYarnLockfile } from './yarn-parser';
import {
  normalizePackageJson,
  pruneProjectGraph,
} from './project-graph-pruning';

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
  if (packageManager === 'yarn') {
    const content = readFileSync(YARN_LOCK_PATH, 'utf8');
    return parseYarnLockfile(content);
  }
  if (packageManager === 'pnpm') {
    const content = readFileSync(PNPM_LOCK_PATH, 'utf8');
    return parsePnpmLockfile(content);
  }
  if (packageManager === 'npm') {
    const content = readFileSync(NPM_LOCK_PATH, 'utf8');
    return parseNpmLockfile(content);
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
  const normalizedPackageJson = normalizePackageJson(packageJson);

  let content, graph;
  if (packageManager === 'yarn') {
    content = readFileSync(YARN_LOCK_PATH, 'utf8');
    graph = parsePnpmLockfile(content);
  }
  if (packageManager === 'pnpm') {
    content = readFileSync(PNPM_LOCK_FILE, 'utf8');
    graph = parsePnpmLockfile(content);
  }
  if (packageManager === 'npm') {
    content = readFileSync(NPM_LOCK_FILE, 'utf8');
    graph = parseNpmLockfile(content);
  }
  if (!content) {
    throw new Error(`Unknown package manager: ${packageManager}`);
  }

  const prunedGraph = pruneProjectGraph(graph, packageJson);
  if (packageManager === 'yarn') {
    return stringifyYarnLockfile(prunedGraph, content, normalizedPackageJson);
  }
  if (packageManager === 'pnpm') {
    return stringifyPnpmLockfile(prunedGraph, content, normalizedPackageJson);
  }
  if (packageManager === 'npm') {
    return stringifyNpmLockfile(prunedGraph, content, normalizedPackageJson);
  }
}

function hashString(fileContent: string): string {
  return defaultHashing.hashArray([fileContent]);
}
