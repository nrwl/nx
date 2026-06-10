/**
 * This is the main API for accessing the lock file functionality.
 * It encapsulates the package manager specific logic and implementation details.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gte } from 'semver';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';
import {
  CreateDependenciesContext,
  CreateNodesContext,
} from '../../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../../project-graph/project-graph-builder';
import { readJsonFile } from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import { PackageJson } from '../../../utils/package-json';
import {
  detectPackageManager,
  PackageManager,
} from '../../../utils/package-manager';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  BUN_LOCK_FILE,
  BUN_TEXT_LOCK_FILE,
  getBunTextLockfileDependencies,
  getBunTextLockfileNodes,
} from './bun-parser';
import {
  getNpmLockfileDependencies,
  getNpmLockfileNodes,
  stringifyNpmLockfile,
} from './npm-parser';
import {
  getPnpmLockfileDependencies,
  getPnpmLockfileNodes,
  stringifyPnpmLockfile,
} from './pnpm-parser';
import { pruneProjectGraph } from './project-graph-pruning';
import { normalizePackageJson } from './utils/package-json';
import {
  getYarnLockfileDependencies,
  getYarnLockfileNodes,
  stringifyYarnLockfile,
} from './yarn-parser';

const YARN_LOCK_FILE = 'yarn.lock';
const NPM_LOCK_FILE = 'package-lock.json';
const PNPM_LOCK_FILE = 'pnpm-lock.yaml';
const PNPM_LOCK_FILE_LEGACY = 'pnpm-lock.yml';

export const LOCKFILES = [
  YARN_LOCK_FILE,
  NPM_LOCK_FILE,
  PNPM_LOCK_FILE,
  BUN_LOCK_FILE,
  BUN_TEXT_LOCK_FILE,
];

export const AUTO_AFFECTED_LOCK_FILES = [
  YARN_LOCK_FILE,
  NPM_LOCK_FILE,
  PNPM_LOCK_FILE,
  PNPM_LOCK_FILE_LEGACY,
  BUN_LOCK_FILE,
  BUN_TEXT_LOCK_FILE,
] as const;

const YARN_LOCK_PATH = join(workspaceRoot, YARN_LOCK_FILE);
const NPM_LOCK_PATH = join(workspaceRoot, NPM_LOCK_FILE);
const PNPM_LOCK_PATH = join(workspaceRoot, PNPM_LOCK_FILE);
const BUN_LOCK_PATH = join(workspaceRoot, BUN_LOCK_FILE);
const BUN_TEXT_LOCK_PATH = join(workspaceRoot, BUN_TEXT_LOCK_FILE);

const LOCK_FILE_TO_PACKAGE_MANAGER: Record<string, PackageManager> = {
  [PNPM_LOCK_FILE]: 'pnpm',
  [YARN_LOCK_FILE]: 'yarn',
  [NPM_LOCK_FILE]: 'npm',
  [BUN_TEXT_LOCK_FILE]: 'bun',
  [BUN_LOCK_FILE]: 'bun',
};

/**
 * Walks up from the workspace root looking for `fileName` in an ancestor
 * directory. Used when a nested workspace shares a parent monorepo's install
 * and therefore has no lockfile of its own.
 */
function findAncestorFile(fileName: string): string | null {
  let dir = dirname(workspaceRoot);
  while (dir !== dirname(dir)) {
    const candidate = join(dir, fileName);
    if (existsSync(candidate)) {
      return candidate;
    }
    dir = dirname(dir);
  }
  return null;
}

function resolveLockPath(localPath: string, fileName: string): string {
  if (existsSync(localPath)) {
    return localPath;
  }
  return findAncestorFile(fileName) ?? localPath;
}

/**
 * Finds the nearest ancestor lockfile of any supported package manager and
 * infers the package manager from it. Returns `null` when the workspace root
 * has a lockfile of its own (the regular file-driven processing handles it)
 * or when no ancestor lockfile exists.
 */
export function findAncestorLockFile(): {
  lockFilePath: string;
  packageManager: PackageManager;
} | null {
  for (const fileName of Object.keys(LOCK_FILE_TO_PACKAGE_MANAGER)) {
    if (existsSync(join(workspaceRoot, fileName))) {
      return null;
    }
  }
  let dir = dirname(workspaceRoot);
  while (dir !== dirname(dir)) {
    for (const [fileName, packageManager] of Object.entries(
      LOCK_FILE_TO_PACKAGE_MANAGER
    )) {
      const candidate = join(dir, fileName);
      if (existsSync(candidate)) {
        return { lockFilePath: candidate, packageManager };
      }
    }
    dir = dirname(dir);
  }
  return null;
}

/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileGraph}
 */
export function getLockFileNodes(
  packageManager: PackageManager,
  contents: string,
  lockFileHash: string,
  context: CreateNodesContext,
  importerPath?: string
): {
  nodes: Record<string, ProjectGraphExternalNode>;
  keyMap: Map<string, any>;
} {
  try {
    const packageJson =
      packageManager === 'yarn' || packageManager === 'bun'
        ? readJsonFile(join(context.workspaceRoot, 'package.json'))
        : undefined;

    return getLockFileNodesForName(
      getLockFileName(packageManager),
      contents,
      lockFileHash,
      packageJson,
      importerPath
    );
  } catch (e) {
    if (!isPostInstallProcess()) {
      output.error({
        title: `Failed to parse ${packageManager} lockfile`,
        bodyLines: errorBodyLines(e),
      });
    }
    throw e;
  }
  throw new Error(`Unknown package manager: ${packageManager}`);
}

export function getLockFileNodesForName(
  lockFile: string,
  contents: string,
  lockFileHash: string,
  packageJson?: PackageJson,
  importerPath?: string
): {
  nodes: Record<string, ProjectGraphExternalNode>;
  keyMap: Map<string, any>;
} {
  if (lockFile === YARN_LOCK_FILE || lockFile === BUN_LOCK_FILE) {
    // yarn-parser only reads optional fields plus an unused `name` for the
    // synthetic root workspace node, which is identical across base/head and
    // therefore irrelevant for affected diffing.
    return getYarnLockfileNodes(
      contents,
      lockFileHash,
      packageJson ?? ({} as PackageJson)
    );
  }
  if (lockFile === PNPM_LOCK_FILE || lockFile === PNPM_LOCK_FILE_LEGACY) {
    return getPnpmLockfileNodes(contents, lockFileHash, importerPath);
  }
  if (lockFile === NPM_LOCK_FILE) {
    return getNpmLockfileNodes(contents, lockFileHash);
  }
  if (lockFile === BUN_TEXT_LOCK_FILE) {
    const nodes = getBunTextLockfileNodes(contents, lockFileHash);
    return { nodes, keyMap: new Map() };
  }
  throw new Error(`Unknown lock file: ${lockFile}`);
}

/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileGraph}
 */
export function getLockFileDependencies(
  packageManager: PackageManager,
  contents: string,
  lockFileHash: string,
  context: CreateDependenciesContext,
  keyMap: Map<string, any>,
  importerPath?: string
): RawProjectGraphDependency[] {
  try {
    if (packageManager === 'yarn') {
      return getYarnLockfileDependencies(
        contents,
        lockFileHash,
        context,
        keyMap
      );
    }
    if (packageManager === 'pnpm') {
      return getPnpmLockfileDependencies(
        contents,
        lockFileHash,
        context,
        keyMap,
        importerPath
      );
    }
    if (packageManager === 'npm') {
      return getNpmLockfileDependencies(
        contents,
        lockFileHash,
        context,
        keyMap
      );
    }
    if (packageManager === 'bun') {
      const lockFilePath = getLockFilePath(packageManager);
      if (lockFilePath.endsWith(BUN_TEXT_LOCK_FILE)) {
        // Bun parser doesn't use keyMap
        return getBunTextLockfileDependencies(contents, lockFileHash, context);
      } else {
        // Fallback to yarn parser for binary format
        return getYarnLockfileDependencies(
          contents,
          lockFileHash,
          context,
          keyMap
        );
      }
    }
  } catch (e) {
    if (!isPostInstallProcess()) {
      output.error({
        title: `Failed to parse ${packageManager} lockfile`,
        bodyLines: errorBodyLines(e),
      });
    }
    throw e;
  }
  throw new Error(`Unknown package manager: ${packageManager}`);
}

export function lockFileExists(packageManager: PackageManager): boolean {
  if (packageManager === 'yarn') {
    return existsSync(resolveLockPath(YARN_LOCK_PATH, YARN_LOCK_FILE));
  }
  if (packageManager === 'pnpm') {
    return existsSync(resolveLockPath(PNPM_LOCK_PATH, PNPM_LOCK_FILE));
  }
  if (packageManager === 'npm') {
    return existsSync(resolveLockPath(NPM_LOCK_PATH, NPM_LOCK_FILE));
  }
  if (packageManager === 'bun') {
    return existsSync(BUN_LOCK_PATH) || existsSync(BUN_TEXT_LOCK_PATH);
  }
  throw new Error(
    `Unknown package manager ${packageManager} or lock file missing`
  );
}

/**
 * Returns lock file name based on the detected package manager in the root
 * @param packageManager
 * @returns
 */
export function getLockFileName(packageManager: PackageManager): string {
  if (packageManager === 'yarn') {
    return YARN_LOCK_FILE;
  }
  if (packageManager === 'pnpm') {
    return PNPM_LOCK_FILE;
  }
  if (packageManager === 'npm') {
    return NPM_LOCK_FILE;
  }
  if (packageManager === 'bun') {
    const lockFilePath = getLockFilePath(packageManager);
    return lockFilePath.endsWith(BUN_TEXT_LOCK_FILE)
      ? BUN_TEXT_LOCK_FILE
      : BUN_LOCK_FILE;
  }
  throw new Error(`Unknown package manager: ${packageManager}`);
}

export function getLockFilePath(packageManager: PackageManager): string {
  if (packageManager === 'yarn') {
    return resolveLockPath(YARN_LOCK_PATH, YARN_LOCK_FILE);
  }
  if (packageManager === 'pnpm') {
    return resolveLockPath(PNPM_LOCK_PATH, PNPM_LOCK_FILE);
  }
  if (packageManager === 'npm') {
    return resolveLockPath(NPM_LOCK_PATH, NPM_LOCK_FILE);
  }
  if (packageManager === 'bun') {
    try {
      // Check if text format exists first (prefer over binary)
      if (existsSync(BUN_TEXT_LOCK_PATH)) {
        return BUN_TEXT_LOCK_PATH;
      }
      // Fall back to binary format
      if (existsSync(BUN_LOCK_PATH)) {
        return BUN_LOCK_PATH;
      }

      const bunVersion = execSync('bun --version', { windowsHide: true })
        .toString()
        .trim();
      // Version-based fallback
      if (gte(bunVersion, '1.2.0')) {
        return BUN_TEXT_LOCK_PATH;
      }
      return BUN_LOCK_PATH;
    } catch {
      return BUN_LOCK_PATH;
    }
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
  graph: ProjectGraph,
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): string {
  const normalizedPackageJson = normalizePackageJson(packageJson);
  const content = readFileSync(getLockFilePath(packageManager), 'utf8');

  try {
    if (packageManager === 'yarn') {
      const prunedGraph = pruneProjectGraph(graph, packageJson);
      return stringifyYarnLockfile(prunedGraph, content, normalizedPackageJson);
    }
    if (packageManager === 'pnpm') {
      const prunedGraph = pruneProjectGraph(graph, packageJson);
      return stringifyPnpmLockfile(
        prunedGraph,
        content,
        normalizedPackageJson,
        workspaceRoot
      );
    }
    if (packageManager === 'npm') {
      const prunedGraph = pruneProjectGraph(graph, packageJson);
      return stringifyNpmLockfile(prunedGraph, content, normalizedPackageJson);
    }
    if (packageManager === 'bun') {
      output.log({
        title:
          "Unable to create bun lock files. Run bun install it's just as quick",
      });
      return '';
    }
  } catch (e) {
    if (!isPostInstallProcess()) {
      const additionalInfo = [
        'To prevent the build from breaking we are returning the root lock file.',
      ];
      if (packageManager === 'npm') {
        additionalInfo.push(
          'If you run `npm install --package-lock-only` in your output folder it will regenerate the correct pruned lockfile.'
        );
      }
      if (packageManager === 'pnpm') {
        additionalInfo.push(
          'If you run `pnpm install --lockfile-only` in your output folder it will regenerate the correct pruned lockfile.'
        );
      }
      output.error({
        title: 'An error occurred while creating pruned lockfile',
        bodyLines: errorBodyLines(e, additionalInfo),
      });
    }
    return content;
  }
}

// generate body lines for error message
function errorBodyLines(originalError: Error, additionalInfo: string[] = []) {
  return [
    'Please open an issue at `https://github.com/nrwl/nx/issues/new?template=1-bug.yml` and provide a reproduction.',

    ...additionalInfo,

    `\nOriginal error: ${originalError.message}\n\n`,
    originalError.stack,
  ];
}

function isPostInstallProcess(): boolean {
  return (
    process.env.npm_command === 'install' &&
    process.env.npm_lifecycle_event === 'postinstall'
  );
}
