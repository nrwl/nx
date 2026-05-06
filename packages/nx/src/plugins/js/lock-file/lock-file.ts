/**
 * This is the main API for accessing the lock file functionality.
 * It encapsulates the package manager specific logic and implementation details.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gte } from 'semver';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';
import {
  CreateDependenciesContext,
  CreateNodesContextV2,
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

/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileGraph}
 */
export function getLockFileNodes(
  packageManager: PackageManager,
  contents: string,
  lockFileHash: string,
  context: CreateNodesContextV2
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
      packageJson
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
  packageJson: PackageJson = {} as PackageJson
): {
  nodes: Record<string, ProjectGraphExternalNode>;
  keyMap: Map<string, any>;
} {
  if (lockFile === YARN_LOCK_FILE || lockFile === BUN_LOCK_FILE) {
    return getYarnLockfileNodes(contents, lockFileHash, packageJson);
  }
  if (lockFile === PNPM_LOCK_FILE || lockFile === PNPM_LOCK_FILE_LEGACY) {
    return getPnpmLockfileNodes(contents, lockFileHash);
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
