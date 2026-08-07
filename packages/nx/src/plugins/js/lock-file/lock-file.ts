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
import { PackageJson } from '../../../utils/package-json';
import {
  dropInheritedPnpmPatchedDependencies,
  rewritePrunedLocalPathSpecifiers,
  stripPrunedLockfilePnpmConfig,
  validatePrunedLocalPathClosure,
  warnIncompletePrunedPnpmOutput,
} from './pruned-output';
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
 * A pruned pnpm lockfile no longer declares the resolution-time pnpm config it
 * bakes into its snapshots, so the config is dropped from `packageJson` too:
 * pnpm 10 and below validate the manifest against the lockfile and abort a
 * frozen install with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH when the two disagree.
 * The manifest is left alone for npm and yarn, which never read that block.
 * Mutating it means callers must write or emit the manifest after this returns.
 *
 * The lockfile alone does not make a complete pnpm output. A workspace
 * declaring build-script approvals, patches or vendored local paths also needs
 * the artifacts `createPrunedLockfile` and the emitters carry, and this warns
 * when that is the case.
 *
 * On a pruning error the root lockfile is returned as a fail-open fallback,
 * with the manifest left as authored.
 */
export function createLockFile(
  packageJson: PackageJson,
  graph: ProjectGraph,
  packageManager: PackageManager = detectPackageManager(workspaceRoot)
): string {
  let pruned = true;
  const lockFileContent = buildLockFile(packageJson, graph, packageManager, {
    onPruneFallback: () => {
      pruned = false;
    },
  });
  if (pruned && packageManager === 'pnpm') {
    stripPrunedLockfilePnpmConfig(packageJson);
    warnIncompletePrunedPnpmOutput(lockFileContent);
  }
  return lockFileContent;
}

/**
 * `createLockFile` without the manifest reconciliation, for callers that own
 * that step themselves. `options.onPruneFallback` fires just before the
 * root-lockfile fallback is returned, so a caller can skip work that only makes
 * sense for an actually pruned lockfile (e.g. link-closure validation and
 * local-path artifact shipping).
 */
function buildLockFile(
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
 * steps such a flow needs around `createLockFile`. For pnpm, the manifest's
 * `file:`/`link:` local-path specifiers are relocated to their shipped location
 * first (pnpm re-resolves them on a non-frozen install, and the lockfile copies
 * the manifest's form), and the local-path dependency closure is validated
 * after pruning so a shipped `link:` target that requires an unresolvable
 * dependency fails the build instead of the deploy. After a successful prune,
 * the manifest's pnpm config block is stripped for every package manager:
 * re-declaring config a pruned pnpm lockfile bakes into its snapshots trips
 * ERR_PNPM_LOCKFILE_CONFIG_MISMATCH, and npm and yarn never read the block at
 * install time, so dropping it does not change their installs. An inherited
 * `pnpm.patchedDependencies` is dropped on both paths, since the sinks below
 * declare the patches the output actually ships.
 *
 * `pruned` is false when `createLockFile` fell back to the root lockfile on a
 * pruning error: the fallback's importer describes the whole workspace, so the
 * manifest mutations are rolled back (the root lockfile matches the manifest as
 * authored: original local-path specifiers, the rest of the pnpm config kept),
 * the closure validation is skipped, and the caller must not ship local-path
 * artifacts for it. Pass `pruned` as `includeLocalPathArtifacts` to
 * `emitPrunedPnpmInstallAssets`/`writePrunedPnpmInstallSettings`, which carry
 * the remaining install-time pieces (the pnpm 11 settings-only
 * pnpm-workspace.yaml, the patch files, the local-path artifacts, and the
 * pnpm <=10 package.json declarations).
 *
 * Mutates `packageJson` (the pnpm-only specifier relocation and the config
 * strip), so write or emit the manifest after calling this. Not for bun, which
 * has no lockfile generation.
 */
export function createPrunedLockfile(
  packageJson: PackageJson,
  graph: ProjectGraph,
  projectRoot: string,
  workspaceRootPath: string = workspaceRoot,
  packageManager: PackageManager = detectPackageManager(workspaceRootPath)
): { lockFileContent: string; pruned: boolean } {
  const originalPackageJson = structuredClone(packageJson);
  if (packageManager === 'pnpm') {
    rewritePrunedLocalPathSpecifiers(
      packageJson,
      projectRoot,
      workspaceRootPath,
      new Set(getWorkspacePackagesFromGraph(graph).keys())
    );
  }
  let pruneError: Error | undefined;
  const lockFileContent = buildLockFile(packageJson, graph, packageManager, {
    onPruneFallback: (error) => {
      pruneError = error;
    },
  });
  const pruned = pruneError === undefined;
  if (pruned) {
    stripPrunedLockfilePnpmConfig(packageJson);
    if (packageManager === 'pnpm') {
      validatePrunedLocalPathClosure(
        packageJson,
        workspaceRootPath,
        lockFileContent
      );
    }
  } else {
    // The root lockfile matches the manifest as authored, so undo the
    // specifier relocation and keep the pnpm config it still declares.
    for (const key of Object.keys(packageJson)) {
      delete (packageJson as unknown as Record<string, unknown>)[key];
    }
    Object.assign(packageJson, originalPackageJson);
    // createLockFile's own error output is suppressed under a postinstall, so
    // this is the only signal there naming the cause and what the fallback
    // output is missing.
    const bodyLines = [`The lockfile pruning failed: ${pruneError?.message}`];
    if (packageManager === 'pnpm') {
      bodyLines.push(
        'The emitted package.json keeps its pnpm config, its vendored local-path specifiers point at their original workspace locations, and no local-path artifacts are shipped for it.'
      );
    }
    bodyLines.push(
      packageManager === 'npm'
        ? '`npm ci` in the output will fail; run `npm install` instead.'
        : packageManager === 'yarn'
          ? 'An immutable install of the output (`--immutable`, or `--frozen-lockfile` on yarn 1) may fail; run an install without immutability instead (yarn 2+ turns it on by default in CI).'
          : 'A `--frozen-lockfile` install of the output will fail; run a regular install instead.'
    );
    output.warn({
      title: 'The pruned output falls back to the root lockfile',
      bodyLines,
    });
  }
  dropInheritedPnpmPatchedDependencies(packageJson);
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
