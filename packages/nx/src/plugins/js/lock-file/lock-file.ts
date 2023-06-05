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
import { ProjectGraph } from '../../../config/project-graph';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';
import { PackageJson } from '../../../utils/package-json';
import { fileHasher, hashArray } from '../../../hasher/file-hasher';
import { output } from '../../../utils/output';

import { parseNpmLockfile, stringifyNpmLockfile } from './npm-parser';
import { parsePnpmLockfile, stringifyPnpmLockfile } from './pnpm-parser';
import { parseYarnLockfile, stringifyYarnLockfile } from './yarn-parser';
import { pruneProjectGraph } from './project-graph-pruning';
import { normalizePackageJson } from './utils/package-json';

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
  let content: string;
  if (packageManager === 'yarn') {
    content = readFileSync(YARN_LOCK_PATH, 'utf8');
  }
  if (packageManager === 'pnpm') {
    content = readFileSync(PNPM_LOCK_PATH, 'utf8');
  }
  if (packageManager === 'npm') {
    content = readFileSync(NPM_LOCK_PATH, 'utf8');
  }
  if (content) {
    return hashArray([content]);
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
  const builder = new ProjectGraphBuilder(null, null);
  try {
    if (packageManager === 'yarn') {
      const content = readFileSync(YARN_LOCK_PATH, 'utf8');
      parseYarnLockfile(content, builder);
      return builder.getUpdatedProjectGraph();
    }
    if (packageManager === 'pnpm') {
      const content = readFileSync(PNPM_LOCK_PATH, 'utf8');
      parsePnpmLockfile(content, builder);
      return builder.getUpdatedProjectGraph();
    }
    if (packageManager === 'npm') {
      const content = readFileSync(NPM_LOCK_PATH, 'utf8');
      parseNpmLockfile(content, builder);
      return builder.getUpdatedProjectGraph();
    }
  } catch (e) {
    if (!isPostInstallProcess()) {
      output.error({
        title: `Failed to parse ${packageManager} lockfile`,
        bodyLines: errorBodyLines(e),
      });
    }
    return;
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
  const content = readFileSync(getLockFileName(packageManager), 'utf8');

  const builder = new ProjectGraphBuilder();

  try {
    if (packageManager === 'yarn') {
      parseYarnLockfile(content, builder);
      const graph = builder.getUpdatedProjectGraph();
      const prunedGraph = pruneProjectGraph(graph, packageJson);
      return stringifyYarnLockfile(prunedGraph, content, normalizedPackageJson);
    }
    if (packageManager === 'pnpm') {
      parsePnpmLockfile(content, builder);

      const graph = builder.getUpdatedProjectGraph();
      const prunedGraph = pruneProjectGraph(graph, packageJson);
      return stringifyPnpmLockfile(prunedGraph, content, normalizedPackageJson);
    }
    if (packageManager === 'npm') {
      parseNpmLockfile(content, builder);

      const graph = builder.getUpdatedProjectGraph();
      const prunedGraph = pruneProjectGraph(graph, packageJson);
      return stringifyNpmLockfile(prunedGraph, content, normalizedPackageJson);
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
