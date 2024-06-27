/**
 * This is the main API for accessing the lock file functionality.
 * It encapsulates the package manager specific logic and implementation details.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import {
  detectPackageManager,
  PackageManager,
} from '../../../utils/package-manager';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { RawProjectGraphDependency } from '../../../project-graph/project-graph-builder';
import { PackageJson } from '../../../utils/package-json';
import { output } from '../../../utils/output';

import {
  getNpmLockfileNodes,
  stringifyNpmLockfile,
  getNpmLockfileDependencies,
} from './npm-parser';
import {
  getPnpmLockfileDependencies,
  getPnpmLockfileNodes,
  stringifyPnpmLockfile,
} from './pnpm-parser';
import {
  getYarnLockfileDependencies,
  getYarnLockfileNodes,
  stringifyYarnLockfile,
} from './yarn-parser';
import { pruneProjectGraph } from './project-graph-pruning';
import { normalizePackageJson } from './utils/package-json';
import { readJsonFile } from '../../../utils/fileutils';
import {
  CreateDependenciesContext,
  CreateNodesContext,
} from '../../../project-graph/plugins';

const YARN_LOCK_FILE = 'yarn.lock';
const NPM_LOCK_FILE = 'package-lock.json';
const PNPM_LOCK_FILE = 'pnpm-lock.yaml';
const BUN_LOCK_FILE = 'bun.lockb';
export const LOCKFILES = [
  YARN_LOCK_FILE,
  NPM_LOCK_FILE,
  PNPM_LOCK_FILE,
  BUN_LOCK_FILE,
];

const YARN_LOCK_PATH = join(workspaceRoot, YARN_LOCK_FILE);
const NPM_LOCK_PATH = join(workspaceRoot, NPM_LOCK_FILE);
const PNPM_LOCK_PATH = join(workspaceRoot, PNPM_LOCK_FILE);
const BUN_LOCK_PATH = join(workspaceRoot, BUN_LOCK_FILE);

/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileGraph}
 */
export function getLockFileNodes(
  packageManager: PackageManager,
  contents: string,
  lockFileHash: string,
  context: CreateNodesContext
): Record<string, ProjectGraphExternalNode> {
  try {
    if (packageManager === 'yarn') {
      const packageJson = readJsonFile(
        join(context.workspaceRoot, 'package.json')
      );
      return getYarnLockfileNodes(contents, lockFileHash, packageJson);
    }
    if (packageManager === 'pnpm') {
      return getPnpmLockfileNodes(contents, lockFileHash);
    }
    if (packageManager === 'npm') {
      return getNpmLockfileNodes(contents, lockFileHash);
    }
    if (packageManager === 'bun') {
      // bun uses yarn v1 for the file format
      const packageJson = readJsonFile('package.json');
      return getYarnLockfileNodes(contents, lockFileHash, packageJson);
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

/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileGraph}
 */
export function getLockFileDependencies(
  packageManager: PackageManager,
  contents: string,
  lockFileHash: string,
  context: CreateDependenciesContext
): RawProjectGraphDependency[] {
  try {
    if (packageManager === 'yarn') {
      return getYarnLockfileDependencies(contents, lockFileHash, context);
    }
    if (packageManager === 'pnpm') {
      return getPnpmLockfileDependencies(contents, lockFileHash, context);
    }
    if (packageManager === 'npm') {
      return getNpmLockfileDependencies(contents, lockFileHash, context);
    }
    if (packageManager === 'bun') {
      // bun uses yarn v1 for the file format
      return getYarnLockfileDependencies(contents, lockFileHash, context);
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
    return existsSync(YARN_LOCK_PATH);
  }
  if (packageManager === 'pnpm') {
    return existsSync(PNPM_LOCK_PATH);
  }
  if (packageManager === 'npm') {
    return existsSync(NPM_LOCK_PATH);
  }
  if (packageManager === 'bun') {
    return existsSync(BUN_LOCK_PATH);
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
    return BUN_LOCK_FILE;
  }
  throw new Error(`Unknown package manager: ${packageManager}`);
}

function getLockFilePath(packageManager: PackageManager): string {
  if (packageManager === 'yarn') {
    return YARN_LOCK_PATH;
  }
  if (packageManager === 'pnpm') {
    return PNPM_LOCK_PATH;
  }
  if (packageManager === 'npm') {
    return NPM_LOCK_PATH;
  }
  if (packageManager === 'bun') {
    return BUN_LOCK_PATH;
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
      return stringifyPnpmLockfile(prunedGraph, content, normalizedPackageJson);
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
        title: 'An error occured while creating pruned lockfile',
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
