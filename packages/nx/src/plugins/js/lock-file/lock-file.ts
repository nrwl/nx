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
  CreateNodesContext,
} from '../../../project-graph/plugins';
import { RawProjectGraphDependency } from '../../../project-graph/project-graph-builder';
import { readJsonFile } from '../../../utils/fileutils';
import { output } from '../../../utils/output';
import {
  PackageJson,
  rewritePrunedLocalPathSpecifiers,
  validatePrunedLocalPathClosure,
} from '../../../utils/package-json';
import {
  detectPackageManager,
  PackageManager,
} from '../../../utils/package-manager';
import { workspaceRoot } from '../../../utils/workspace-root';
import { getWorkspacePackagesFromGraph } from '../utils/get-workspace-packages-from-graph';
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
  context: CreateNodesContext
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
  packageJson?: PackageJson
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

/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileGraph}
 */
export function getLockFileDependencies(
  packageManager: PackageManager,
  contents: string,
  lockFileHash: string,
  context: CreateDependenciesContext,
  keyMap: Map<string, any>
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
        keyMap
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
    return existsSync(YARN_LOCK_PATH);
  }
  if (packageManager === 'pnpm') {
    return existsSync(PNPM_LOCK_PATH);
  }
  if (packageManager === 'npm') {
    return existsSync(NPM_LOCK_PATH);
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
    return YARN_LOCK_PATH;
  }
  if (packageManager === 'pnpm') {
    return PNPM_LOCK_PATH;
  }
  if (packageManager === 'npm') {
    return NPM_LOCK_PATH;
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
 * On a pruning error the root lockfile is returned as a fail-open fallback;
 * `options.onPruneFallback` fires just before that so callers can skip work
 * that only makes sense for an actually pruned lockfile (e.g. link-closure
 * validation and local-path artifact shipping).
 *
 * @param packageJson
 * @param isProduction
 * @param packageManager
 * @returns
 */
export function createLockFile(
  packageJson: PackageJson,
  graph: ProjectGraph,
  packageManager: PackageManager = detectPackageManager(workspaceRoot),
  options?: { onPruneFallback?: (error: Error) => void }
): string {
  const normalizedPackageJson = normalizePackageJson(packageJson);
  const content = readFileSync(getLockFilePath(packageManager), 'utf8');

  try {
    if (packageManager === 'bun') {
      output.log({
        title:
          "Unable to create bun lock files. Run bun install it's just as quick",
      });
      return '';
    }
    const prunedGraph = pruneProjectGraph(
      graph,
      packageJson,
      workspaceRoot,
      packageManager
    );
    if (packageManager === 'yarn') {
      return stringifyYarnLockfile(prunedGraph, content, normalizedPackageJson);
    }
    if (packageManager === 'pnpm') {
      return stringifyPnpmLockfile(
        prunedGraph,
        content,
        normalizedPackageJson,
        workspaceRoot
      );
    }
    if (packageManager === 'npm') {
      return stringifyNpmLockfile(prunedGraph, content, normalizedPackageJson);
    }
  } catch (e) {
    options?.onPruneFallback?.(e);
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

/**
 * Creates the pruned lockfile for a generate-package-json flow, running the
 * pnpm-specific steps every such flow needs around `createLockFile`: the
 * manifest's `file:`/`link:` local-path specifiers are relocated to their
 * shipped location first (pnpm re-resolves them on a non-frozen install, and
 * the lockfile copies the manifest's form), and the local-path dependency
 * closure is validated afterwards so a shipped `link:` target that requires an
 * unresolvable dependency fails the build instead of the deploy.
 *
 * `pruned` is false when `createLockFile` fell back to the root lockfile on a
 * pruning error (already logged): the fallback's importer describes the whole
 * workspace, so the closure validation is skipped and the caller must not ship
 * local-path artifacts for it. Pass `pruned` as `includeLocalPathArtifacts` to
 * `emitPrunedPnpmInstallAssets`/`writePrunedPnpmInstallSettings`, which carry
 * the remaining install-time pieces (the pnpm 11 settings-only
 * pnpm-workspace.yaml, the patch files, the local-path artifacts, and the
 * pnpm <=10 package.json declarations).
 *
 * Mutates `packageJson` (the specifier relocation), so write or emit the
 * manifest after calling this. Not for bun, which has no lockfile generation.
 */
export function createPrunedLockfile(
  packageJson: PackageJson,
  graph: ProjectGraph,
  projectRoot: string,
  workspaceRootPath: string = workspaceRoot,
  packageManager: PackageManager = detectPackageManager(workspaceRootPath)
): { lockFileContent: string; pruned: boolean } {
  if (packageManager === 'pnpm') {
    rewritePrunedLocalPathSpecifiers(
      packageJson,
      projectRoot,
      workspaceRootPath,
      new Set(getWorkspacePackagesFromGraph(graph).keys())
    );
  }
  let pruned = true;
  const lockFileContent = createLockFile(packageJson, graph, packageManager, {
    onPruneFallback: () => {
      pruned = false;
    },
  });
  if (packageManager === 'pnpm' && pruned) {
    validatePrunedLocalPathClosure(
      packageJson,
      workspaceRootPath,
      lockFileContent
    );
  }
  return { lockFileContent, pruned };
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
