/**
 * This is the main API for accessing the lock file functionality.
 * It encapsulates the package manager specific logic and implementation details.
 */

import { execSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
  dropInheritedPnpmPatchedDependencies,
  getLocalPathArtifacts,
  getPrunedPnpmInstallArtifacts,
  type PrunedDeployArtifact,
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
  getBunInstalledLocalPathNodes,
  getBunLocalPathNodeSources,
  getBunLockfilePatchKeys,
  getBunTextLockfileDependencies,
  getBunTextLockfileNodes,
  getPrunedBunLocalPathTargets,
  getPrunedBunPatchArtifacts,
  stringifyBunLockfile,
  validatePrunedBunLocalPathClosure,
} from './bun-parser';
import type { PinnedManifestSpec } from './bun-parser';
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
 * Parses the lockfile into external nodes, plus the keyMap that getLockFileDependencies reads.
 * `bunPatchFileHashes` are the patch files of a bun.lock that `lockFileHash` covers.
 * `localPathSources` lists the workspace-relative sources of the nodes installed
 * from the local file tree, whose contents the node hashes do not cover.
 * `installedLocalPathNodes` names the local-path node each importer installs
 * per dependency name, keyed by the importer's path ('.' for the root).
 */
export function getLockFileNodes(
  packageManager: PackageManager,
  lockFile: string,
  contents: string,
  lockFileHash: string,
  context: CreateNodesContext,
  bunPatchFileHashes?: Map<string, string>
): {
  nodes: Record<string, ProjectGraphExternalNode>;
  keyMap: Map<string, any>;
  localPathSources?: Record<string, string[]>;
  installedLocalPathNodes: Record<string, Record<string, string>>;
} {
  try {
    const packageJson =
      packageManager === 'yarn' || packageManager === 'bun'
        ? readJsonFile(join(context.workspaceRoot, 'package.json'))
        : undefined;

    return getLockFileNodesForName(
      lockFile,
      contents,
      lockFileHash,
      packageJson,
      bunPatchFileHashes
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
  bunPatchFileHashes?: Map<string, string>
): {
  nodes: Record<string, ProjectGraphExternalNode>;
  keyMap: Map<string, any>;
  localPathSources?: Record<string, string[]>;
  installedLocalPathNodes: Record<string, Record<string, string>>;
} {
  if (lockFile === YARN_LOCK_FILE || lockFile === BUN_LOCK_FILE) {
    // yarn-parser only reads optional fields plus an unused `name` for the
    // synthetic root workspace node, which is identical across base/head and
    // therefore irrelevant for affected diffing.
    return {
      ...getYarnLockfileNodes(
        contents,
        lockFileHash,
        packageJson ?? ({} as PackageJson)
      ),
      // No record for Yarn or bun.lockb; imports resolve by version and name
      installedLocalPathNodes: {},
    };
  }
  if (lockFile === PNPM_LOCK_FILE || lockFile === PNPM_LOCK_FILE_LEGACY) {
    return getPnpmLockfileNodes(contents, lockFileHash);
  }
  if (lockFile === NPM_LOCK_FILE) {
    return getNpmLockfileNodes(contents, lockFileHash);
  }
  if (lockFile === BUN_TEXT_LOCK_FILE) {
    const nodes = getBunTextLockfileNodes(
      contents,
      lockFileHash,
      bunPatchFileHashes
    );
    return {
      nodes,
      keyMap: new Map(),
      localPathSources: getBunLocalPathNodeSources(
        contents,
        lockFileHash,
        nodes
      ),
      installedLocalPathNodes: getBunInstalledLocalPathNodes(
        contents,
        lockFileHash,
        nodes
      ),
    };
  }
  throw new Error(`Unknown lock file: ${lockFile}`);
}

/**
 * Parses the lockfile into dependencies between external nodes.
 */
export function getLockFileDependencies(
  packageManager: PackageManager,
  lockFile: string,
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
      if (lockFile === BUN_TEXT_LOCK_FILE) {
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

const BUN_TEXT_LOCKFILE_HINT =
  'Run `bun install --save-text-lockfile` at the workspace root to switch to bun.lock.';

// Only the text bun.lock can be pruned. Without it, a Bun deploy output ships
// the manifest alone.
export function hasTextBunLockfile(workspaceRootPath: string): boolean {
  return existsSync(join(workspaceRootPath, BUN_TEXT_LOCK_FILE));
}

// Same precedence as getLockFilePath, against the root the caller prunes from.
function usesBinaryBunLockfile(workspaceRootPath: string): boolean {
  return (
    !hasTextBunLockfile(workspaceRootPath) &&
    existsSync(join(workspaceRootPath, BUN_LOCK_FILE))
  );
}

// A pruned Bun lockfile is always the text bun.lock.
function getPrunedLockFileName(packageManager: PackageManager): string {
  return packageManager === 'bun'
    ? BUN_TEXT_LOCK_FILE
    : getLockFileName(packageManager);
}

// Bun trusts the install scripts of the packages the install root lists, and a
// list replaces Bun's default one, so the output carries the workspace root's.
function mergeRootTrustedDependencies(
  packageJson: PackageJson,
  workspaceRootPath: string
): void {
  const rootPackageJsonPath = join(workspaceRootPath, 'package.json');
  if (!existsSync(rootPackageJsonPath)) {
    return;
  }
  const { trustedDependencies } =
    readJsonFile<PackageJson>(rootPackageJsonPath);
  if (!trustedDependencies) {
    return;
  }
  packageJson.trustedDependencies = [
    ...new Set([
      ...trustedDependencies,
      ...(packageJson.trustedDependencies ?? []),
    ]),
  ];
}

/**
 * Create lock file based on the root level lock file and (pruned) package.json
 *
 * A pruned pnpm lockfile no longer declares the resolution-time pnpm config it
 * bakes into its snapshots, so the config is dropped from `packageJson` too:
 * pnpm 10 and below validate the manifest against the lockfile and abort a
 * frozen install with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH when the two disagree.
 * An inherited `pnpm.patchedDependencies` goes with it, since the prune scopes
 * the lockfile's patches to the packages that survive it and rewrites their
 * paths onto the output.
 * The manifest is left alone for npm, yarn and bun, which never read that block.
 * Mutating it means callers must write or emit the manifest after this returns.
 *
 * The lockfile alone does not make a complete pnpm output. A workspace
 * declaring build-script approvals, patches or vendored local paths also needs
 * the artifacts `generatePrunedDeployOutput` ships, and this warns when that is
 * the case. A Bun workspace needs its patch files and vendored local paths the
 * same way.
 *
 * On a pruning error the root lockfile is returned as a fail-open fallback,
 * with the manifest left as authored.
 *
 * @deprecated Use `generatePrunedDeployOutput` instead. This will be removed in Nx 25.
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
    dropInheritedPnpmPatchedDependencies(packageJson);
    warnIncompletePrunedPnpmOutput(lockFileContent);
  }
  if (pruned && packageManager === 'bun') {
    warnIncompletePrunedBunOutput(lockFileContent);
  }
  return lockFileContent;
}

// The pieces a pruned bun.lock needs beside it, which only
// `generatePrunedDeployOutput` ships.
function warnIncompletePrunedBunOutput(lockFileContent: string): void {
  const missing: string[] = [];
  if (getBunLockfilePatchKeys(lockFileContent).length) {
    missing.push('the patch files and the patchedDependencies they need');
  }
  if (getPrunedBunLocalPathTargets(lockFileContent).length) {
    missing.push('the vendored file:/link: dependencies it references');
  }
  if (!missing.length) {
    return;
  }
  output.warn({
    title: 'The pruned bun.lock needs artifacts this call does not return',
    bodyLines: [
      `A standalone install of the output will be missing ${missing.join(
        ', and '
      )}.`,
      'Use generatePrunedDeployOutput to ship them.',
    ],
  });
}

/**
 * `createLockFile` without the manifest reconciliation, for callers that own
 * that step themselves. `options.onPruneFallback` fires just before the
 * root-lockfile fallback is returned, so a caller can skip work that only makes
 * sense for an actually pruned lockfile (e.g. link-closure validation and
 * local-path artifact shipping). Every root-relative read resolves from
 * `options.workspaceRootPath`, so a caller passing one cannot end up with the
 * lockfile read from one root and the catalogs resolved from another. Without
 * `options.projectRoot`, a manifest dependency named like a workspace package
 * is taken to be that package.
 */
function buildLockFile(
  packageJson: PackageJson,
  graph: ProjectGraph,
  packageManager: PackageManager = detectPackageManager(workspaceRoot),
  options?: {
    onPruneFallback?: (error: Error) => void;
    workspaceRootPath?: string;
    projectRoot?: string;
    onPinnedSpec?: (pin: PinnedManifestSpec) => void;
  }
): string {
  const workspaceRootPath = options?.workspaceRootPath ?? workspaceRoot;
  if (packageManager === 'bun' && usesBinaryBunLockfile(workspaceRootPath)) {
    output.log({
      title: 'Unable to create a pruned lockfile from the binary bun.lockb',
      bodyLines: [BUN_TEXT_LOCKFILE_HINT],
    });
    return '';
  }
  const normalizedPackageJson = normalizePackageJson(packageJson);
  const content = readFileSync(
    join(workspaceRootPath, getPrunedLockFileName(packageManager)),
    'utf8'
  );

  try {
    if (packageManager === 'bun') {
      return stringifyBunLockfile(
        graph,
        content,
        normalizedPackageJson,
        workspaceRootPath,
        options?.projectRoot,
        options?.onPinnedSpec
      );
    }
    const prunedGraph = pruneProjectGraph(
      graph,
      packageJson,
      workspaceRootPath,
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
        workspaceRootPath,
        options?.projectRoot
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
 * steps such a flow needs around `createLockFile`. For pnpm and Bun, the
 * manifest's `file:`/`link:` local-path specifiers are relocated to their
 * shipped location first (both re-resolve them on a non-frozen install, and the
 * lockfile copies the manifest's form), and the local-path dependency closure
 * is validated after pruning so a shipped `link:` target that requires an
 * unresolvable dependency fails the build instead of the deploy. After a successful prune,
 * the manifest's pnpm config block is stripped for every package manager:
 * re-declaring config a pruned pnpm lockfile bakes into its snapshots trips
 * ERR_PNPM_LOCKFILE_CONFIG_MISMATCH, and npm and yarn never read the block at
 * install time, so dropping it does not change their installs. An inherited
 * `pnpm.patchedDependencies` is dropped on both paths, since the sinks below
 * declare the patches the output actually ships.
 *
 * `pruned` is false when the prune failed and the root lockfile was returned on a
 * pruning error: the fallback's importer describes the whole workspace, so the
 * manifest mutations are rolled back (the root lockfile matches the manifest as
 * authored: original local-path specifiers, the rest of the pnpm config kept),
 * the closure validation is skipped, and the remaining install-time pieces must
 * not ship local-path artifacts for it (see `getPrunedPnpmInstallArtifacts`).
 *
 * Mutates `packageJson` (the pnpm and Bun specifier relocation, the config
 * strip, and for Bun the `overrides`/`resolutions` strip and the locked version
 * of each dependency an override installed outside its range or in place of
 * its local path), so write or emit the manifest after calling this.
 */
function createPrunedLockfile(
  packageJson: PackageJson,
  graph: ProjectGraph,
  projectRoot: string,
  workspaceRootPath: string = workspaceRoot,
  packageManager: PackageManager = detectPackageManager(workspaceRootPath)
): { lockFileContent: string; pruned: boolean } {
  const originalPackageJson = structuredClone(packageJson);
  if (packageManager === 'pnpm' || packageManager === 'bun') {
    rewritePrunedLocalPathSpecifiers(
      packageJson,
      projectRoot,
      workspaceRootPath,
      getWorkspacePackagesFromGraph(graph),
      packageManager
    );
  }
  if (packageManager === 'bun') {
    // Bun reads these only from the workspace root, whose effect the pruned
    // bun.lock already locks, so a project's own block never applied.
    delete packageJson.overrides;
    delete packageJson.resolutions;
  }
  const pinnedSpecs: PinnedManifestSpec[] = [];
  let pruneError: Error | undefined;
  const lockFileContent = buildLockFile(packageJson, graph, packageManager, {
    onPruneFallback: (error) => {
      pruneError = error;
    },
    workspaceRootPath,
    projectRoot,
    onPinnedSpec: (pin) => pinnedSpecs.push(pin),
  });
  const pruned = pruneError === undefined;
  if (pruned) {
    for (const { depType, name, spec } of pinnedSpecs) {
      packageJson[depType][name] = spec;
    }
    stripPrunedLockfilePnpmConfig(packageJson);
    if (packageManager === 'pnpm') {
      validatePrunedLocalPathClosure(
        packageJson,
        workspaceRootPath,
        lockFileContent
      );
    } else if (packageManager === 'bun') {
      validatePrunedBunLocalPathClosure(
        packageJson,
        workspaceRootPath,
        lockFileContent
      );
    }
  } else {
    // The root lockfile matches the manifest as authored, so undo the
    // specifier relocation and the Bun override strip, and keep the pnpm
    // config it still declares.
    for (const key of Object.keys(packageJson)) {
      delete (packageJson as unknown as Record<string, unknown>)[key];
    }
    Object.assign(packageJson, originalPackageJson);
    // The pruning error output is suppressed under a postinstall, so
    // this is the only signal there naming the cause and what the fallback
    // output is missing.
    const bodyLines = [`The lockfile pruning failed: ${pruneError?.message}`];
    if (packageManager === 'pnpm') {
      bodyLines.push(
        'The emitted package.json keeps its resolution-time pnpm config (`overrides`, `packageExtensions`), its vendored local-path specifiers point at their original workspace locations, and no local-path artifacts are shipped for it.'
      );
    } else if (packageManager === 'bun') {
      bodyLines.push(
        'The vendored local-path specifiers of the emitted package.json point at their original workspace locations, and no local-path artifacts are shipped for it.'
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

type PrunedDeploySink =
  | { outputDirectory: string; emit?: never }
  | {
      emit: (path: string, content: string | Buffer) => void;
      outputDirectory?: never;
    };

/**
 * Generates the standalone deploy output a generate-package-json flow ships
 * alongside its manifest: the pruned lockfile and the install-time artifacts
 * that lockfile needs. For pnpm those are the settings-only pnpm-workspace.yaml,
 * the `pnpm patch` files, and the vendored non-workspace local-path
 * dependencies; for Bun, the `bun patch` files and the vendored local-path
 * dependencies.
 * `options` carries either an `outputDirectory` to write into or an `emit` sink
 * for a bundler's asset pipeline, never both.
 *
 * Mutates `packageJson` into the form the output must ship (the relocated
 * local-path specifiers, the pnpm config strip, the pnpm <=10 build settings,
 * the Bun root `trustedDependencies`, pruned `patchedDependencies`, override
 * strip and pinned versions), so write or emit the manifest after this returns.
 *
 * A Bun workspace without the text bun.lock, on the binary bun.lockb or with no
 * lockfile at all, gets no lockfile: it warns and ships nothing, leaving the
 * manifest as authored. A Bun manifest without
 * dependencies also ships no lockfile, as Bun writes none for it.
 */
export function generatePrunedDeployOutput(
  packageJson: PackageJson,
  graph: ProjectGraph,
  projectRoot: string,
  options: PrunedDeploySink & {
    packageManager: PackageManager;
    workspaceRoot?: string;
  }
): void {
  const workspaceRootPath = options.workspaceRoot ?? workspaceRoot;
  const { packageManager } = options;
  if (packageManager === 'bun' && !hasTextBunLockfile(workspaceRootPath)) {
    output.warn({
      title: 'Bun lockfile generation requires the text bun.lock',
      bodyLines: usesBinaryBunLockfile(workspaceRootPath)
        ? [
            'The workspace uses the binary bun.lockb, so only the package.json is generated.',
            BUN_TEXT_LOCKFILE_HINT,
          ]
        : [
            'The workspace has no bun.lock, so only the package.json is generated.',
          ],
    });
    return;
  }
  if (packageManager === 'bun') {
    mergeRootTrustedDependencies(packageJson, workspaceRootPath);
  }
  const { lockFileContent, pruned } = createPrunedLockfile(
    packageJson,
    graph,
    projectRoot,
    workspaceRootPath,
    packageManager
  );
  // A pruned bun.lock is empty for a manifest without dependencies, which
  // ships without one.
  const shipsLockFile = !(packageManager === 'bun' && lockFileContent === '');
  const artifacts: PrunedDeployArtifact[] = shipsLockFile
    ? [
        {
          path: getPrunedLockFileName(packageManager),
          content: lockFileContent,
        },
      ]
    : [];
  if (packageManager === 'pnpm') {
    artifacts.push(
      ...getPrunedPnpmInstallArtifacts(
        workspaceRootPath,
        lockFileContent,
        packageJson,
        { includeLocalPathArtifacts: pruned }
      )
    );
  }
  if (packageManager === 'bun') {
    artifacts.push(
      ...getPrunedBunPatchArtifacts(
        workspaceRootPath,
        lockFileContent,
        packageJson
      )
    );
    // The root-lockfile fallback references the whole workspace.
    if (pruned) {
      artifacts.push(
        ...getLocalPathArtifacts(
          workspaceRootPath,
          getPrunedBunLocalPathTargets(lockFileContent)
        )
      );
    }
  }

  // Discriminate on the value, not key presence: options built by spread can
  // carry an explicitly-present `outputDirectory: undefined` beside `emit`.
  if (options.outputDirectory !== undefined) {
    const { outputDirectory } = options;
    // Bun rejects a frozen install when a lockfile from a prior deploy sits
    // beside a manifest without dependencies.
    if (!shipsLockFile) {
      rmSync(join(outputDirectory, getPrunedLockFileName(packageManager)), {
        force: true,
      });
    }
    // Directory trees flow through here one file at a time, so dedupe the
    // recursive mkdir per destination directory.
    const createdDirs = new Set<string>();
    for (const artifact of artifacts) {
      const destination = join(outputDirectory, artifact.path);
      const destinationDir = dirname(destination);
      if (!createdDirs.has(destinationDir)) {
        mkdirSync(destinationDir, { recursive: true });
        createdDirs.add(destinationDir);
      }
      if ('sourcePath' in artifact) {
        copyFileSync(artifact.sourcePath, destination);
      } else {
        writeFileSync(destination, artifact.content);
      }
    }
  } else {
    for (const artifact of artifacts) {
      options.emit(
        artifact.path,
        'sourcePath' in artifact
          ? readFileSync(artifact.sourcePath)
          : artifact.content
      );
    }
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
