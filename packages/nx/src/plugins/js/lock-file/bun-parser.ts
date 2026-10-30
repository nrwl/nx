import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, posix } from 'node:path';
import { satisfies, validRange } from 'semver';
import {
  DependencyType,
  type ProjectGraph,
  type ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { hashArray, hashFile } from '../../../hasher/file-hasher';
import type { CreateDependenciesContext } from '../../../project-graph/plugins';
import {
  type RawProjectGraphDependency,
  validateDependency,
} from '../../../project-graph/project-graph-builder';
import { getCatalogManager } from '../../../utils/catalog';
import { fileExists, readJsonFile } from '../../../utils/fileutils';
import { parseJson } from '../../../utils/json';
import type { PackageJson } from '../../../utils/package-json';
import { getWorkspacePackagesFromGraph } from '../utils/get-workspace-packages-from-graph';
import {
  getPrunedPatchFiles,
  isUnderWorkspaceModules,
  type LocalPathArtifactTarget,
  normalizePrunedPatchedDependencies,
  relocatePrunedLocalPathSpec,
  resolveWorkspaceModuleDependency,
  uncontainLocalPath,
  uncontainLocalPathSpec,
  validateLocalPathClosures,
} from './pruned-output';
import type { NormalizedPackageJson } from './utils/package-json';

// Highest bun.lock version this parser has been verified against:
// - 1: workspace packages are no longer listed with their dependencies
// - 2: identical content, stricter validation in Bun's own reader
// - 3: values in "overrides" may be objects holding rules scoped to a parent
//      package (`"parent": { "child": "1.0.0" }`) and keys may carry a version
//      selector (`"parent@1"`, `"child@<2"`). This parser never reads
//      "overrides"; the resolved packages are listed in "packages" as before.
// Newer versions are parsed on a best-effort basis instead of being rejected
// outright.
const MAX_KNOWN_LOCKFILE_VERSION = 3;

const DEPENDENCY_TYPES = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

/**
 * Bun text-based lockfile structure
 * Based on comprehensive analysis of bun.lock.zig source code
 */
interface BunLockFile {
  /** Version of the lockfile format (0 to 3 as of Bun 1.4) */
  lockfileVersion: number;

  configVersion?: number;

  /**
   * Version rules from the root package.json "overrides"/"resolutions".
   * Values are version specs, or (lockfileVersion 3) objects of rules scoped
   * to the dependencies of the package named by the key. Not used by this
   * parser: the resolutions they produce are already reflected in `packages`.
   */
  overrides?: Record<string, string | Record<string, string>>;

  /** The root manifest's `trustedDependencies` that are installed */
  trustedDependencies?: string[];

  /**
   * Workspaces configuration - maps workspace paths to their dependencies
   * Empty string "" represents the root workspace
   */
  workspaces: Record<string, Workspace>;

  /**
   * Package definitions - maps package identifiers to package metadata
   */
  packages: Record<string, PackageTuple>;

  /** Maps a patched package's resolution (`name@version`) to its patch file */
  patchedDependencies?: Record<string, string>;
}

interface Workspace {
  /** Workspace package name */
  name?: string;
  /** Workspace package version */
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalPeers?: string[];
}

// Union type for different package tuple formats based on resolution protocol
type PackageTuple =
  | WorkspacePackageTuple
  | FilePackageTuple
  | GitPackageTuple
  | NpmPackageTuple;

// Workspace package: ["name@workspace:path"]
type WorkspacePackageTuple = [string];

// File/Link package: ["name@file:path", metadata]
type FilePackageTuple = [string, PackageDependencies];

// Git package: ["name@git+<url>#commit", metadata, commit]
type GitPackageTuple = [string, PackageDependencies, string];

// NPM package: ["name@version", tarballUrl, metadata, hash]
type NpmPackageTuple = [string, string, PackageDependencies, string];

interface PackageDependencies {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalPeers?: string[];
  bundled?: boolean;
}

/**
 * Pre-computed index for O(1) lookups instead of O(n) scans
 */
interface PackageIndex {
  // Map: packageName -> array of {version, packageKey, hash}
  byName: Map<
    string,
    Array<{ version: string; packageKey: string; hash: string }>
  >;
  // Set of all workspace package names (from workspace: deps)
  workspaceNames: Set<string>;
  // Set of all workspace paths
  workspacePaths: Set<string>;
  // Set of packages that have workspace-specific variants
  packagesWithWorkspaceVariants: Set<string>;
  localPathSources: Map<string, BunLocalPathSource>;
}

interface BunLocalPathSource {
  kind: 'directory' | 'link' | 'tarball';
  // Relative to the lockfile's directory.
  path: string;
}

export const BUN_LOCK_FILE = 'bun.lockb';
export const BUN_TEXT_LOCK_FILE = 'bun.lock';

let currentLockFileHash: string;
let cachedParsedLockFile: BunLockFile;
let cachedPackageIndex: PackageIndex;

const keyMap = new Map<string, ProjectGraphExternalNode>();
const specParseCache = new Map<
  string,
  { name: string; version: string; protocol: string }
>();
// Memoizes (packageName, versionSpec) -> resolved version for the current
// lockfile. The same name/range pairs repeat across many dependency lists, so
// the semver resolution is done once per distinct pair instead of per edge.
const resolvedVersionCache = new Map<string, string | null>();

// Structured error types for better error handling
export class BunLockfileParseError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BunLockfileParseError';
  }
}

export function readBunLockFile(lockFilePath: string): string {
  if (lockFilePath.endsWith(BUN_TEXT_LOCK_FILE)) {
    return readFileSync(lockFilePath, { encoding: 'utf-8' });
  }

  return execSync(`bun ${lockFilePath}`, {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 10,
    windowsHide: true,
  });
}

export function getBunTextLockfileDependencies(
  lockFileContent: string,
  lockFileHash: string,
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  try {
    const { lockFile, index } = parseLockFile(lockFileContent, lockFileHash);

    const dependencies: RawProjectGraphDependency[] = [];
    const workspacePackages = new Set(Object.keys(ctx.projects));

    if (!lockFile.workspaces || Object.keys(lockFile.workspaces).length === 0) {
      return dependencies;
    }

    const packageDeps = processPackageToPackageDependencies(
      lockFile,
      index,
      ctx,
      workspacePackages
    );
    dependencies.push(...packageDeps);

    return dependencies;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(
      `Failed to get Bun lockfile dependencies: ${error.message}`
    );
  }
}

/** @internal */
export function clearCache(): void {
  currentLockFileHash = undefined;
  cachedParsedLockFile = undefined;
  cachedPackageIndex = undefined;
  keyMap.clear();
  specParseCache.clear();
  resolvedVersionCache.clear();
}

// ===== UTILITY FUNCTIONS =====

function getCachedSpecInfo(resolvedSpec: string): {
  name: string;
  version: string;
  protocol: string;
} {
  let cached = specParseCache.get(resolvedSpec);
  if (!cached) {
    const { name, version } = parseResolvedSpec(resolvedSpec);
    const protocol = getProtocolFromResolvedSpec(resolvedSpec);
    cached = { name, version, protocol };
    specParseCache.set(resolvedSpec, cached);
  }
  return cached;
}

function getProtocolFromResolvedSpec(resolvedSpec: string): string {
  // Handle scoped packages properly
  let protocolAndSpec: string;

  if (resolvedSpec.startsWith('@')) {
    // For scoped packages, find the second @ which separates name from protocol
    const secondAtIndex = resolvedSpec.indexOf('@', 1);
    if (secondAtIndex === -1) {
      return 'npm'; // Default fallback
    }
    protocolAndSpec = resolvedSpec.substring(secondAtIndex + 1);
  } else {
    // For non-scoped packages, find the first @ which separates name from protocol
    const firstAtIndex = resolvedSpec.indexOf('@');
    if (firstAtIndex === -1) {
      return 'npm'; // Default fallback
    }
    protocolAndSpec = resolvedSpec.substring(firstAtIndex + 1);
  }

  const colonIndex = protocolAndSpec.indexOf(':');
  if (colonIndex === -1) {
    return 'npm'; // No protocol specified, default to npm
  }

  return protocolAndSpec.substring(0, colonIndex);
}

function parseResolvedSpec(resolvedSpec: string): {
  name: string;
  version: string;
} {
  // Handle different resolution formats:
  // - "package-name@npm:1.0.0"
  // - "@scope/package-name@npm:1.0.0"
  // - "package-name@github:user/repo#commit"
  // - "package-name@file:./path"
  // - "package-name@https://example.com/package.tgz"
  // - "alias-name@npm:actual-package@version" (ALIAS FORMAT)

  // Handle scoped packages properly - they have an extra @ at the beginning
  // Format: @scope/package@protocol:spec
  let name: string;
  let protocolAndSpec: string;

  if (resolvedSpec.startsWith('@')) {
    // For scoped packages, find the second @ which separates name from protocol
    const secondAtIndex = resolvedSpec.indexOf('@', 1);
    if (secondAtIndex === -1) {
      return { name: '', version: '' };
    }
    name = resolvedSpec.substring(0, secondAtIndex);
    protocolAndSpec = resolvedSpec.substring(secondAtIndex + 1);
  } else {
    // For non-scoped packages, find the first @ which separates name from protocol
    const firstAtIndex = resolvedSpec.indexOf('@');
    if (firstAtIndex === -1) {
      return { name: '', version: '' };
    }
    name = resolvedSpec.substring(0, firstAtIndex);
    protocolAndSpec = resolvedSpec.substring(firstAtIndex + 1);
  }

  // Parse protocol and spec
  const colonIndex = protocolAndSpec.indexOf(':');

  // Handle specs without protocol prefix (e.g., "package@1.0.0"), which is how
  // Bun records every registry package, aliases included
  if (colonIndex === -1) {
    // No protocol specified, treat as npm package with direct version
    return { name, version: protocolAndSpec };
  }

  const protocol = protocolAndSpec.substring(0, colonIndex);
  const spec = protocolAndSpec.substring(colonIndex + 1);

  if (protocol === 'workspace') {
    // Workspace dependencies use the workspace path as version
    return { name, version: `workspace:${spec}` };
  } else if (protocol === 'github' || protocol.startsWith('git+')) {
    // Extract commit hash from GitHub/Git reference
    // Format: user/repo#commit-hash (github:) or repo-url#commit-hash
    // (git+https:, git+ssh:, git+file:)
    const gitMatch = spec.match(/^(.+?)#(.+)$/);
    if (gitMatch) {
      const [, repo, commit] = gitMatch;
      return { name, version: `${protocol}:${repo}#${commit}` };
    } else {
      return { name, version: `${protocol}:${spec}` };
    }
  } else if (protocol === 'file' || protocol === 'link') {
    // File/Link dependencies use the file path as version
    return { name, version: `${protocol}:${spec}` };
  } else if (protocol === 'https' || protocol === 'http') {
    // Tarball dependencies use the full URL as version
    return { name, version: `${protocol}:${spec}` };
  } else {
    // For any other protocols, use the original spec as version
    return { name, version: resolvedSpec };
  }
}

function calculatePackageHash(packageData: PackageTuple): string {
  const [resolvedSpec, tarballUrl, metadata, hash] = packageData;

  // For NPM packages (4 elements), use the integrity hash
  if (packageData.length === 4 && hash && typeof hash === 'string') {
    return hash;
  }

  // For other package types, calculate hash from available data
  const hashData = [resolvedSpec];
  if (tarballUrl && typeof tarballUrl === 'string') hashData.push(tarballUrl);
  if (metadata) hashData.push(JSON.stringify(metadata));
  if (hash && typeof hash === 'string') hashData.push(hash);

  return hashArray(hashData);
}

// A patched package installs its tarball plus the patch, as the pnpm parser
// also hashes it.
function withPatchHash(hash: string, patchHash: string | undefined): string {
  return patchHash === undefined ? hash : hashArray([hash, patchHash]);
}

/**
 * Determines if a package is an alias by comparing the package key with the resolved spec name
 * In Bun lockfiles, aliases are identified when the package key differs from the resolved package name
 */
function isAliasPackage(
  packageKey: string,
  resolvedPackageName: string
): boolean {
  return packageKey !== resolvedPackageName;
}

/**
 * Build a pre-computed index for O(1) lookups
 * This is the key optimization - we do one pass through all packages
 * and build indexes that can be queried in O(1) time later
 */
function buildPackageIndex(lockFile: BunLockFile): PackageIndex {
  const byName = new Map<
    string,
    Array<{ version: string; packageKey: string; hash: string }>
  >();
  const workspaceNames = new Set<string>();
  const workspacePaths = new Set<string>();
  const packagesWithWorkspaceVariants = new Set<string>();

  // Collect workspace paths
  if (lockFile.workspaces) {
    for (const workspacePath of Object.keys(lockFile.workspaces)) {
      if (workspacePath !== '') {
        workspacePaths.add(workspacePath);
      }
    }
  }

  // Collect workspace package names from workspace dependencies. A `file:`
  // spec can name a vendored package, and a workspace it names is recorded as
  // a `workspace:` package, which the pass below picks up.
  if (lockFile.workspaces) {
    for (const workspace of Object.values(lockFile.workspaces)) {
      const allDeps = {
        ...workspace.dependencies,
        ...workspace.devDependencies,
        ...workspace.optionalDependencies,
        ...workspace.peerDependencies,
      };
      for (const [depName, depVersion] of Object.entries(allDeps)) {
        if (depVersion.startsWith('workspace:')) {
          workspaceNames.add(depName);
        }
      }
    }
  }

  // Single pass through all packages to build indexes
  if (lockFile.packages) {
    for (const [packageKey, packageData] of Object.entries(lockFile.packages)) {
      if (!Array.isArray(packageData) || packageData.length < 1) {
        continue;
      }

      const resolvedSpec = packageData[0];
      if (typeof resolvedSpec !== 'string') {
        continue;
      }

      const { name, version, protocol } = getCachedSpecInfo(resolvedSpec);
      if (!name || !version) {
        continue;
      }

      // Track workspace packages from packages section
      if (protocol === 'workspace') {
        workspaceNames.add(name);
      }

      // Check if this is a workspace-specific variant (e.g., "@quz/pkg1/lodash")
      if (packageKey.includes('/') && packageKey !== name) {
        // Check if it ends with a package name pattern
        const lastSlash = packageKey.lastIndexOf('/');
        if (lastSlash > 0) {
          const possiblePackageName = packageKey.substring(lastSlash + 1);
          const prefix = packageKey.substring(0, lastSlash);

          // If the prefix is a workspace path or scoped package pattern
          // For scoped packages, require prefix to contain '/' (e.g., "@scope/pkg")
          // to avoid incorrectly matching just "@scope"
          if (
            workspacePaths.has(prefix) ||
            (prefix.startsWith('@') && prefix.includes('/'))
          ) {
            packagesWithWorkspaceVariants.add(possiblePackageName);
          }
        }
      }

      // Build the byName index
      let entries = byName.get(name);
      if (!entries) {
        entries = [];
        byName.set(name, entries);
      }

      // Calculate hash once
      const hash = calculatePackageHash(packageData as PackageTuple);

      entries.push({ version, packageKey, hash });
    }
  }

  return {
    byName,
    workspaceNames,
    workspacePaths,
    packagesWithWorkspaceVariants,
    localPathSources: getBunLocalPathSources(lockFile),
  };
}

function normalizeBunLocalPath(path: string): string {
  return posix.normalize(path.replace(/\\/g, '/')).replace(/(.)\/+$/, '$1');
}

/**
 * The packages a bun.lock installs from the local file tree, keyed by package
 * key. A directory or link entry records its path relative to the lockfile. A
 * tarball entry records it relative to the dependent that declares it: the
 * workspace or local directory whose lookup reaches the entry for a `file:`
 * spec of that path. A tarball no declarer reaches is left out.
 */
function getBunLocalPathSources(
  lockFile: Pick<BunLockFile, 'packages' | 'workspaces'>
): Map<string, BunLocalPathSource> {
  const sources = new Map<string, BunLocalPathSource>();
  const packages = lockFile.packages ?? {};
  const workspaces = lockFile.workspaces ?? {};
  const tarballPaths = new Map<string, string>();
  for (const [key, tuple] of Object.entries(packages)) {
    if (!Array.isArray(tuple) || typeof tuple[0] !== 'string') {
      continue;
    }
    const { version, protocol } = getCachedSpecInfo(tuple[0]);
    if (protocol === 'file' || protocol === 'link') {
      const path = normalizeBunLocalPath(version.slice(protocol.length + 1));
      if (
        protocol === 'file' &&
        Object.prototype.hasOwnProperty.call(workspaces, path)
      ) {
        continue;
      }
      sources.set(key, {
        kind: protocol === 'file' ? 'directory' : 'link',
        path,
      });
    } else if (
      protocol === 'npm' &&
      tuple[1] !== null &&
      typeof tuple[1] === 'object'
    ) {
      // A registry entry records its registry URL there instead.
      tarballPaths.set(key, normalizeBunLocalPath(version));
    }
  }
  if (!tarballPaths.size) {
    return sources;
  }

  const hasKey = (key: string) =>
    Object.prototype.hasOwnProperty.call(packages, key);
  const declarers: Array<{
    scope: string[];
    dir: string;
    dependencies: PackageDependencies | undefined;
  }> = [];
  for (const [path, workspace] of Object.entries(workspaces)) {
    if (path === '' || workspace.name) {
      declarers.push({
        scope: path === '' ? [] : [workspace.name],
        dir: path,
        dependencies: workspace,
      });
    }
  }
  for (const [key, source] of sources) {
    if (source.kind === 'directory') {
      declarers.push({
        scope: splitBunPackageKey(key),
        dir: source.path,
        dependencies: extractPackageDependencies(packages[key] as unknown[]),
      });
    }
  }
  for (const { scope, dir, dependencies } of declarers) {
    for (const depType of DEPENDENCY_TYPES) {
      for (const [name, spec] of Object.entries(
        dependencies?.[depType] ?? {}
      )) {
        if (typeof spec !== 'string' || !spec.startsWith('file:')) {
          continue;
        }
        const key = findNearestBunPackageKey(scope, name, hasKey);
        const recordedPath =
          key === undefined ? undefined : tarballPaths.get(key);
        if (
          recordedPath === undefined ||
          sources.has(key) ||
          recordedPath !== normalizeBunLocalPath(spec.slice(5))
        ) {
          continue;
        }
        sources.set(key, {
          kind: 'tarball',
          path: posix.isAbsolute(recordedPath)
            ? recordedPath
            : normalizeBunLocalPath(posix.join(dir, recordedPath)),
        });
      }
    }
  }
  return sources;
}

function parseLockFile(
  lockFileContent: string,
  lockFileHash: string
): { lockFile: BunLockFile; index: PackageIndex } {
  if (
    currentLockFileHash === lockFileHash &&
    cachedParsedLockFile &&
    cachedPackageIndex
  ) {
    return { lockFile: cachedParsedLockFile, index: cachedPackageIndex };
  }

  clearCache();

  try {
    const result = parseJson<BunLockFile>(lockFileContent, {
      allowTrailingComma: true,
      expectComments: true,
    });

    // Validate basic structure
    if (!result || typeof result !== 'object') {
      throw new Error('Lockfile root must be an object');
    }

    // Validate lockfile version
    if (result.lockfileVersion !== undefined) {
      if (typeof result.lockfileVersion !== 'number') {
        throw new Error(
          `Lockfile version must be a number, got ${typeof result.lockfileVersion}`
        );
      }

      if (
        !Number.isInteger(result.lockfileVersion) ||
        result.lockfileVersion < 0
      ) {
        throw new Error(
          `Unsupported lockfile version ${result.lockfileVersion}. Lockfile version must be a non-negative integer`
        );
      }

      if (result.lockfileVersion > MAX_KNOWN_LOCKFILE_VERSION) {
        console.warn(
          `bun.lock has lockfileVersion ${result.lockfileVersion}, which is newer than the version ${MAX_KNOWN_LOCKFILE_VERSION} this version of Nx was tested with. Attempting to parse it anyway.`
        );
      }
    }

    if (!result.packages || typeof result.packages !== 'object') {
      throw new Error('Lockfile packages section must be an object');
    }

    if (!result.workspaces || typeof result.workspaces !== 'object') {
      throw new Error('Lockfile workspaces section must be an object');
    }

    cachedParsedLockFile = result;
    currentLockFileHash = lockFileHash;

    // Build the optimized index
    cachedPackageIndex = buildPackageIndex(result);

    return { lockFile: result, index: cachedPackageIndex };
  } catch (error) {
    // Handle JSON parsing errors
    if (
      error.message.includes('JSON') ||
      error.message.includes('InvalidSymbol')
    ) {
      throw new BunLockfileParseError(
        'Failed to parse Bun lockfile: Invalid JSON syntax. Please check for syntax errors or regenerate the lockfile.',
        error
      );
    }

    // Re-throw parsing errors as-is (for validation errors)
    if (error instanceof Error) {
      throw error;
    }

    // Handle unknown errors
    throw new BunLockfileParseError(
      `Failed to parse Bun lockfile: ${error.message}`,
      error
    );
  }
}

// ===== MAIN EXPORT FUNCTIONS =====

/**
 * @param patchFileHashes the {@link getBunPatchFileHashes} that `lockFileHash`
 * covers, folded into the hashes of the packages they patch. Omitted, patched
 * packages hash like unpatched ones.
 */
export function getBunTextLockfileNodes(
  lockFileContent: string,
  lockFileHash: string,
  patchFileHashes?: Map<string, string>
): Record<string, ProjectGraphExternalNode> {
  try {
    const { lockFile, index } = parseLockFile(lockFileContent, lockFileHash);

    const nodes: Record<string, ProjectGraphExternalNode> = {};
    const localPackageVersions = new Map<string, Set<string>>();

    if (!lockFile.packages || Object.keys(lockFile.packages).length === 0) {
      return nodes;
    }

    const patchHashes = new Map<string, string>();
    for (const [resolution, patchPath] of Object.entries(
      lockFile.patchedDependencies ?? {}
    )) {
      const patchHash = patchFileHashes?.get(patchPath);
      if (patchHash !== undefined) {
        patchHashes.set(resolution, patchHash);
      }
    }

    const packageEntries = Object.entries(lockFile.packages);

    for (const [packageKey, packageData] of packageEntries) {
      const result = processPackageEntry(
        packageKey,
        packageData,
        lockFile,
        index,
        keyMap,
        nodes,
        localPackageVersions,
        patchHashes
      );
      if (result.shouldContinue) {
        continue;
      }
    }

    createHoistedNodes(localPackageVersions, lockFile, index, keyMap, nodes);

    return nodes;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get Bun lockfile nodes: ${error.message}`);
  }
}

/**
 * The workspace-relative sources of the `nodes` that install from the local
 * file tree, keyed by node name. The lockfile records only their paths, so the
 * contents of these sources are what change when the packages do.
 */
export function getBunLocalPathNodeSources(
  lockFileContent: string,
  lockFileHash: string,
  nodes: Record<string, ProjectGraphExternalNode>
): Record<string, string[]> {
  const { lockFile, index } = parseLockFile(lockFileContent, lockFileHash);
  const sourcesByResolution = new Map<string, Set<string>>();
  for (const [key, source] of index.localPathSources) {
    const { name, version } = getCachedSpecInfo(
      lockFile.packages[key][0] as string
    );
    const resolution = `${name}@${version}`;
    if (!sourcesByResolution.has(resolution)) {
      sourcesByResolution.set(resolution, new Set());
    }
    sourcesByResolution.get(resolution).add(source.path);
  }
  const nodeSources: Record<string, string[]> = {};
  if (!sourcesByResolution.size) {
    return nodeSources;
  }
  for (const node of Object.values(nodes)) {
    const sources = sourcesByResolution.get(
      `${node.data.packageName}@${node.data.version}`
    );
    if (sources) {
      nodeSources[node.name] = [...sources].sort();
    }
  }
  return nodeSources;
}

interface PackageProcessingResult {
  shouldContinue: boolean;
}

function processPackageEntry(
  packageKey: string,
  packageData: unknown,
  lockFile: BunLockFile,
  index: PackageIndex,
  keyMap: Map<string, ProjectGraphExternalNode>,
  nodes: Record<string, ProjectGraphExternalNode>,
  packageVersions: Map<string, Set<string>>,
  patchHashes: Map<string, string>
): PackageProcessingResult {
  try {
    if (
      !Array.isArray(packageData) ||
      packageData.length < 1 ||
      packageData.length > 4
    ) {
      console.warn(
        `Lockfile contains invalid package entry '${packageKey}'. Try regenerating the lockfile with 'bun install --force'.\nDebug: expected 1-4 elements, got ${JSON.stringify(
          packageData
        )}`
      );
      return { shouldContinue: true };
    }

    const [resolvedSpec] = packageData;

    if (typeof resolvedSpec !== 'string') {
      console.warn(
        `Lockfile contains corrupted package entry '${packageKey}'. Try regenerating the lockfile with 'bun install --force'.\nDebug: expected string, got ${typeof resolvedSpec}`
      );
      return { shouldContinue: true };
    }

    const { name, version, protocol } = getCachedSpecInfo(resolvedSpec);

    if (!name || !version) {
      console.warn(
        `Lockfile contains unrecognized package format. Try regenerating the lockfile with 'bun install --force'.\nDebug: could not parse resolved spec '${resolvedSpec}'`
      );
      return { shouldContinue: true };
    }

    // O(1) lookups using index
    if (index.workspaceNames.has(name)) {
      return { shouldContinue: true };
    }

    if (protocol === 'workspace') {
      return { shouldContinue: true };
    }

    const isWorkspaceSpecific = isNestedPackageKey(packageKey, index);

    if (!isWorkspaceSpecific && isAliasPackage(packageKey, name)) {
      const aliasName = packageKey;
      const actualPackageName = name;
      const actualVersion = version;

      const aliasNodeKey = `npm:${aliasName}`;
      if (!keyMap.has(aliasNodeKey)) {
        const aliasNode: ProjectGraphExternalNode = {
          type: 'npm',
          name: aliasNodeKey,
          data: {
            version: `npm:${actualPackageName}@${actualVersion}`,
            packageName: aliasName,
            hash: withPatchHash(
              calculatePackageHash(packageData as PackageTuple),
              patchHashes.get(`${actualPackageName}@${actualVersion}`)
            ),
          },
        };
        keyMap.set(aliasNodeKey, aliasNode);
        nodes[aliasNodeKey] = aliasNode;
      }

      const targetNodeKey = `npm:${actualPackageName}@${actualVersion}`;
      if (!keyMap.has(targetNodeKey)) {
        const targetNode: ProjectGraphExternalNode = {
          type: 'npm',
          name: targetNodeKey,
          data: {
            version: actualVersion,
            packageName: actualPackageName,
            hash: withPatchHash(
              calculatePackageHash(packageData as PackageTuple),
              patchHashes.get(`${actualPackageName}@${actualVersion}`)
            ),
          },
        };
        keyMap.set(targetNodeKey, targetNode);
        nodes[targetNodeKey] = targetNode;
      }

      if (!packageVersions.has(aliasName)) {
        packageVersions.set(aliasName, new Set());
      }
      packageVersions
        .get(aliasName)
        .add(`npm:${actualPackageName}@${actualVersion}`);

      if (!packageVersions.has(actualPackageName)) {
        packageVersions.set(actualPackageName, new Set());
      }
      packageVersions.get(actualPackageName).add(actualVersion);
    } else {
      if (!packageVersions.has(name)) {
        packageVersions.set(name, new Set());
      }
      packageVersions.get(name).add(version);

      const nodeKey = `npm:${name}@${version}`;

      if (keyMap.has(nodeKey)) {
        nodes[nodeKey] = keyMap.get(nodeKey);
        return { shouldContinue: false };
      }

      const nodeHash = withPatchHash(
        calculatePackageHash(packageData as PackageTuple),
        patchHashes.get(`${name}@${version}`)
      );

      const node: ProjectGraphExternalNode = {
        type: 'npm',
        name: nodeKey,
        data: {
          version,
          packageName: name,
          hash: nodeHash,
        },
      };

      keyMap.set(nodeKey, node);
      nodes[nodeKey] = node;
    }

    return { shouldContinue: false };
  } catch (error) {
    console.warn(
      `Unable to process package '${packageKey}'. The lockfile may be corrupted. Try regenerating with 'bun install --force'.\nDebug: ${error.message}`
    );
    return { shouldContinue: true };
  }
}

function isWorkspacePackage(
  packageName: string,
  index: PackageIndex,
  workspacePackages: Set<string>
): boolean {
  return (
    workspacePackages.has(packageName) || index.workspaceNames.has(packageName)
  );
}

function resolveAliasTarget(
  versionSpec: string
): { packageName: string; version: string } | null {
  if (!versionSpec.startsWith('npm:')) return null;

  const actualSpec = versionSpec.substring(4);
  const actualAtIndex = actualSpec.lastIndexOf('@');
  return {
    packageName: actualSpec.substring(0, actualAtIndex),
    version: actualSpec.substring(actualAtIndex + 1),
  };
}

function processPackageToPackageDependencies(
  lockFile: BunLockFile,
  index: PackageIndex,
  ctx: CreateDependenciesContext,
  workspacePackages: Set<string>
): RawProjectGraphDependency[] {
  const dependencies: RawProjectGraphDependency[] = [];

  if (!lockFile.packages || Object.keys(lockFile.packages).length === 0) {
    return dependencies;
  }

  const packageEntries = Object.entries(lockFile.packages);
  for (const [packageKey, packageData] of packageEntries) {
    try {
      const packageDeps = processPackageForDependencies(
        packageKey,
        packageData,
        lockFile,
        index,
        ctx,
        workspacePackages
      );
      dependencies.push(...packageDeps);
    } catch (error) {
      continue;
    }
  }

  return dependencies;
}

function processPackageForDependencies(
  packageKey: string,
  packageData: unknown,
  lockFile: BunLockFile,
  index: PackageIndex,
  ctx: CreateDependenciesContext,
  workspacePackages: Set<string>
): RawProjectGraphDependency[] {
  // A local package is nested under the workspace that declares it, and is
  // still its own node.
  const isLocalPackage = index.localPathSources.has(packageKey);
  if (
    index.workspaceNames.has(packageKey) ||
    (isNestedPackageKey(packageKey, index) && !isLocalPackage)
  ) {
    return [];
  }

  if (!Array.isArray(packageData) || packageData.length < 1) {
    return [];
  }

  const [resolvedSpec] = packageData;
  if (typeof resolvedSpec !== 'string') {
    return [];
  }

  const { name: sourcePackageName, version: sourceVersion } =
    getCachedSpecInfo(resolvedSpec);
  if (!sourcePackageName || !sourceVersion) {
    return [];
  }

  const sourceNodeName = `npm:${sourcePackageName}@${sourceVersion}`;
  if (!ctx.externalNodes[sourceNodeName]) {
    return [];
  }

  const packageDependencies = extractPackageDependencies(packageData);
  if (!packageDependencies) {
    return [];
  }

  const dependencies: RawProjectGraphDependency[] = [];
  for (const depType of DEPENDENCY_TYPES) {
    const deps = packageDependencies[depType];
    if (!deps || typeof deps !== 'object') continue;

    const depDependencies = processDependencyEntries(
      deps,
      packageKey,
      sourceNodeName,
      lockFile,
      index,
      ctx,
      workspacePackages
    );
    dependencies.push(...depDependencies);
  }

  // An import resolves a local package to its bare node, since the installed
  // manifest's version is not the lockfile path, so that node carries the
  // same edges.
  const bareNodeName = `npm:${sourcePackageName}`;
  if (
    isLocalPackage &&
    ctx.externalNodes[bareNodeName]?.data.version === sourceVersion
  ) {
    for (const dependency of [...dependencies]) {
      dependencies.push({ ...dependency, source: bareNodeName });
    }
  }

  return dependencies;
}

function extractPackageDependencies(
  packageData: unknown[]
): PackageDependencies | undefined {
  if (
    packageData.length >= 3 &&
    packageData[2] &&
    typeof packageData[2] === 'object'
  ) {
    return packageData[2] as PackageDependencies;
  }

  if (
    packageData.length >= 2 &&
    packageData[1] &&
    typeof packageData[1] === 'object'
  ) {
    return packageData[1] as PackageDependencies;
  }

  return undefined;
}

function processDependencyEntries(
  deps: Record<string, string>,
  sourcePackageKey: string,
  sourceNodeName: string,
  lockFile: BunLockFile,
  index: PackageIndex,
  ctx: CreateDependenciesContext,
  workspacePackages: Set<string>
): RawProjectGraphDependency[] {
  const dependencies: RawProjectGraphDependency[] = [];
  const depsEntries = Object.entries(deps);

  for (const [packageName, versionSpec] of depsEntries) {
    try {
      const dependency = processSingleDependency(
        packageName,
        versionSpec,
        sourcePackageKey,
        sourceNodeName,
        lockFile,
        index,
        ctx,
        workspacePackages
      );

      if (dependency) {
        dependencies.push(dependency);
      }
    } catch (error) {
      continue;
    }
  }

  return dependencies;
}

function processSingleDependency(
  packageName: string,
  versionSpec: string,
  sourcePackageKey: string,
  sourceNodeName: string,
  lockFile: BunLockFile,
  index: PackageIndex,
  ctx: CreateDependenciesContext,
  workspacePackages: Set<string>
): RawProjectGraphDependency | null {
  if (typeof packageName !== 'string' || typeof versionSpec !== 'string') {
    return null;
  }

  // O(1) check using index
  if (isWorkspacePackage(packageName, index, workspacePackages)) {
    return null;
  }

  if (versionSpec.startsWith('workspace:')) {
    return null;
  }

  let targetPackageName = packageName;
  let targetVersion = versionSpec;

  // A "<parent>/<name>" entry records what this parent actually resolved the
  // dependency to. Overrides scoped to a parent (bun.lock v3) can pick a
  // version outside the declared range, so it takes precedence over matching
  // the range against the versions in the lockfile.
  const nestedVersion = resolveNestedVersion(
    sourcePackageKey,
    packageName,
    lockFile
  );
  const aliasTarget = nestedVersion ? null : resolveAliasTarget(versionSpec);
  if (nestedVersion) {
    targetVersion = nestedVersion;
  } else if (aliasTarget) {
    targetPackageName = aliasTarget.packageName;
    targetVersion = aliasTarget.version;
  } else {
    // O(1) lookup using index instead of O(n) scan
    const resolvedVersion = findResolvedVersion(
      packageName,
      versionSpec,
      index
    );

    if (!resolvedVersion) {
      return null;
    }

    targetVersion = resolvedVersion;
  }

  const targetNodeName = resolveTargetNodeName(
    targetPackageName,
    targetVersion,
    ctx
  );

  if (!targetNodeName) {
    return null;
  }

  const dependency: RawProjectGraphDependency = {
    source: sourceNodeName,
    target: targetNodeName,
    type: DependencyType.static,
  };

  try {
    validateDependency(dependency, ctx);
    return dependency;
  } catch (e) {
    return null;
  }
}

function resolveNestedVersion(
  sourcePackageKey: string,
  packageName: string,
  lockFile: BunLockFile
): string | null {
  const nestedEntry = lockFile.packages[`${sourcePackageKey}/${packageName}`];
  if (!Array.isArray(nestedEntry) || typeof nestedEntry[0] !== 'string') {
    return null;
  }

  const { name, version } = getCachedSpecInfo(nestedEntry[0]);
  // aliases ("alias@npm:real@1.0.0") are resolved to the real package by the caller
  if (name !== packageName || !version || version.startsWith('npm:')) {
    return null;
  }

  return version;
}

function resolveTargetNodeName(
  targetPackageName: string,
  targetVersion: string,
  ctx: CreateDependenciesContext
): string | null {
  const hoistedNodeName = `npm:${targetPackageName}`;
  const versionedNodeName = `npm:${targetPackageName}@${targetVersion}`;

  if (ctx.externalNodes[versionedNodeName]) {
    return versionedNodeName;
  }

  if (ctx.externalNodes[hoistedNodeName]) {
    return hoistedNodeName;
  }

  return null;
}

// ===== HOISTING-RELATED FUNCTIONS =====

function createHoistedNodes(
  packageVersions: Map<string, Set<string>>,
  lockFile: BunLockFile,
  index: PackageIndex,
  keyMap: Map<string, ProjectGraphExternalNode>,
  nodes: Record<string, ProjectGraphExternalNode>
): void {
  for (const [packageName, versions] of packageVersions.entries()) {
    const hoistedNodeKey = `npm:${packageName}`;

    if (shouldCreateHoistedNode(packageName, lockFile, index)) {
      const hoistedVersion = getHoistedVersion(packageName, versions, index);
      if (hoistedVersion) {
        const versionedNodeKey = `npm:${packageName}@${hoistedVersion}`;
        const versionedNode = keyMap.get(versionedNodeKey);

        if (versionedNode && !keyMap.has(hoistedNodeKey)) {
          const hoistedNode: ProjectGraphExternalNode = {
            type: 'npm',
            name: hoistedNodeKey,
            data: {
              version: hoistedVersion,
              packageName: packageName,
              hash: versionedNode.data.hash,
            },
          };

          keyMap.set(hoistedNodeKey, hoistedNode);
          nodes[hoistedNodeKey] = hoistedNode;
        }
      }
    }
  }
}

/**
 * Checks if a package key represents a workspace-specific or nested dependency entry
 * These entries should not become external nodes, they are used only for resolution
 *
 * O(1) lookup using pre-computed index
 */
function isNestedPackageKey(packageKey: string, index: PackageIndex): boolean {
  // If the key doesn't contain '/', it's a direct package entry.
  // Work off slash indices instead of split('/')+slice+join to avoid an
  // array allocation per key (this runs for every package entry, twice).
  const lastSlash = packageKey.lastIndexOf('/');
  if (lastSlash === -1) {
    return false;
  }

  // prefix = everything before the last '/'
  const prefix = packageKey.substring(0, lastSlash);

  // O(1) check against known workspace paths
  if (index.workspacePaths.has(prefix)) {
    return true;
  }

  // O(1) check against workspace package names (scoped packages)
  if (index.workspaceNames.has(prefix)) {
    return true;
  }

  // Check for scoped workspace packages (e.g., "@quz/pkg1/lodash")
  // The prefix must contain '/' to be a scoped package (e.g., "@scope/pkg")
  // A prefix like just "@scope" without '/' is not a scoped package
  if (prefix.startsWith('@') && prefix.includes('/')) {
    return true;
  }

  // If the key looks like a simple scoped package (e.g., "@custom/lodash")
  // with a single '/' where the first segment starts with '@', it's likely
  // a scoped package alias, not a nested dependency
  if (packageKey.indexOf('/') === lastSlash && packageKey.startsWith('@')) {
    return false;
  }

  // This could be dependency nesting (e.g., "is-even/is-odd")
  // These should be filtered out as they're not direct packages
  return true;
}

/**
 * Determines if a package should have a hoisted node created
 * O(1) lookup using pre-computed index
 */
function shouldCreateHoistedNode(
  packageName: string,
  lockFile: BunLockFile,
  index: PackageIndex
): boolean {
  if (!lockFile.workspaces || !lockFile.packages) return false;

  // First check if the package has a direct entry in the packages section
  // Direct entries should always be hoisted (they represent the canonical version)
  if (lockFile.packages[packageName]) {
    return true;
  }

  // For packages without direct entries, check if they appear in workspace dependencies
  // and don't have workspace-specific variants (which would cause conflicts)
  let appearsInWorkspace = false;
  for (const workspace of Object.values(lockFile.workspaces)) {
    const allDeps = {
      ...workspace.dependencies,
      ...workspace.devDependencies,
      ...workspace.optionalDependencies,
      ...workspace.peerDependencies,
    };

    if (allDeps[packageName]) {
      appearsInWorkspace = true;
      break;
    }
  }

  // O(1) check using pre-computed index
  if (
    appearsInWorkspace &&
    !index.packagesWithWorkspaceVariants.has(packageName)
  ) {
    return true;
  }

  return false;
}

/**
 * Gets the version that should be used for a hoisted package
 * O(1) lookup using pre-computed index
 */
function getHoistedVersion(
  packageName: string,
  availableVersions: Set<string>,
  index: PackageIndex
): string | null {
  // Use the index to find the main package version
  const candidates = index.byName.get(packageName);
  if (!candidates || candidates.length === 0) {
    return availableVersions.size > 0
      ? availableVersions.values().next().value
      : null;
  }

  // Look for the main package entry (the one where packageKey === packageName)
  const mainEntry = candidates.find((c) => c.packageKey === packageName);
  if (mainEntry && availableVersions.has(mainEntry.version)) {
    return mainEntry.version;
  }

  // Fallback: return the first available version
  return availableVersions.size > 0
    ? availableVersions.values().next().value
    : null;
}

/**
 * Finds the resolved version for a package given its version specification
 *
 * O(1) lookup using pre-computed index instead of O(n) scan through all packages
 */
function findResolvedVersion(
  packageName: string,
  versionSpec: string,
  index: PackageIndex
): string | null {
  // Resolution depends only on (packageName, versionSpec) for a given lockfile
  // (the index is constant per parse), so memoize across edges.
  const cacheKey = `${packageName}\n${versionSpec}`;
  const cached = resolvedVersionCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  const resolved = computeResolvedVersion(packageName, versionSpec, index);
  resolvedVersionCache.set(cacheKey, resolved);
  return resolved;
}

function computeResolvedVersion(
  packageName: string,
  versionSpec: string,
  index: PackageIndex
): string | null {
  // O(1) lookup
  const candidates = index.byName.get(packageName);
  if (!candidates || candidates.length === 0) {
    return null;
  }

  // Check for exact version match first (most common case)
  const exactMatch = candidates.find((c) => c.version === versionSpec);
  if (exactMatch) {
    return exactMatch.version;
  }

  // Handle different version specification patterns
  return findBestVersionMatch(versionSpec, candidates);
}

/**
 * Find the best version match for a given version specification
 * Only operates on the pre-filtered candidates array (usually 1-3 items)
 */
function findBestVersionMatch(
  versionSpec: string,
  candidates: Array<{ version: string; packageKey: string; hash: string }>
): string | null {
  if (candidates.length === 0) {
    return null;
  }

  // For exact matches, return immediately (already checked above but defensive)
  const exactMatch = candidates.find((c) => c.version === versionSpec);
  if (exactMatch) {
    return exactMatch.version;
  }

  // Handle union ranges (||)
  if (versionSpec.includes('||')) {
    const ranges = versionSpec.split('||').map((r) => r.trim());
    for (const range of ranges) {
      const match = findBestVersionMatch(range, candidates);
      if (match) {
        return match;
      }
    }
    return null;
  }

  // Separate semver and non-semver versions
  const semverVersions: typeof candidates = [];
  const nonSemverVersions: typeof candidates = [];

  for (const c of candidates) {
    if (/^\d+\.\d+\.\d+/.test(c.version)) {
      semverVersions.push(c);
    } else {
      nonSemverVersions.push(c);
    }
  }

  // Handle non-semver versions (git, file, etc.)
  if (nonSemverVersions.length > 0) {
    const nonSemverMatch = nonSemverVersions.find(
      (c) => c.version === versionSpec
    );
    if (nonSemverMatch) {
      return nonSemverMatch.version;
    }
    // If no exact match for non-semver, continue to semver matching
  }

  // Handle semver versions
  if (semverVersions.length === 0) {
    // No semver versions, return first non-semver if available
    return nonSemverVersions.length > 0 ? nonSemverVersions[0].version : null;
  }

  // Find all versions that satisfy the spec
  const satisfyingVersions = semverVersions.filter((candidate) => {
    try {
      return satisfies(candidate.version, versionSpec);
    } catch (error) {
      // If semver fails, fall back to string comparison
      return candidate.version === versionSpec;
    }
  });

  if (satisfyingVersions.length === 0) {
    // No satisfying versions found, return the first semver candidate as fallback
    return semverVersions[0].version;
  }

  // Return the highest satisfying version (similar to npm behavior).
  // Single-pass max instead of a full sort: only the top element is used, and
  // the numeric-collation comparator is expensive, so O(n) comparisons beat
  // O(n log n). Keeps the first element on ties, matching the previous stable
  // descending sort followed by [0].
  let best = satisfyingVersions[0];
  for (let i = 1; i < satisfyingVersions.length; i++) {
    const candidate = satisfyingVersions[i];
    let cmp: number;
    try {
      cmp = candidate.version.localeCompare(best.version, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    } catch {
      cmp = candidate.version.localeCompare(best.version);
    }
    if (cmp > 0) {
      best = candidate;
    }
  }

  return best.version;
}

// ===== PRUNED LOCKFILE =====

// Bun resolutions that point into the workspace's own file tree. The pruned
// output ships the local packages `getBunLocalPathSources` lists, and no other.
const LOCAL_RESOLUTION_PROTOCOLS = new Set([
  'root',
  'workspace',
  'file',
  'link',
]);

interface PrunedPackage {
  path: string[];
  // A dependent whose lookup already reaches the same resolution reuses it.
  resolution: string;
  tuple: unknown[];
  // The root lockfile key the package's own dependencies resolve from. Unset
  // for a folder dependency of a folder dependency: Bun never installs its
  // dependencies.
  rootScope?: string[];
  dependencies?: PackageDependencies;
  isWorkspaceModule: boolean;
  // A workspace module's directory, which its dependency specs resolve from.
  workspacePath?: string;
  // The root key and pruned path of the package whose tarball ships this one.
  bundle?: { rootScope: string[]; path: string[] };
}

/**
 * Writes the bun.lock for a standalone install of `packageJson`, with every
 * package at the version the root lockfile installs for it.
 *
 * A bun.lock key is the package's path in the hoisted tree (`a/b` is `b` nested
 * under `a`). A dependency resolves to the nearest key on its dependent's path,
 * and a workspace's dependency checks `<workspace name>/<name>` first. The
 * project graph cannot stand in for that lookup, since it records no
 * dependencies of a nested package. The kept packages are laid out in a new
 * tree rooted at the pruned manifest. Bun rebuilds its hoisting on install, so
 * the layout only has to resolve each dependency to the same package, except
 * that a bundled tree stays under its bundler.
 *
 * Workspace modules become the `file:./workspace_modules/<name>` folder
 * dependencies that copy-workspace-modules ships. `projectRoot` is where the
 * manifest's local-path specs resolve from when telling a vendored package from
 * a workspace module of the same name. Returns an empty string for a manifest
 * without dependencies, which gets no lockfile.
 */
export function stringifyBunLockfile(
  graph: ProjectGraph,
  rootLockFileContent: string,
  packageJson: NormalizedPackageJson,
  workspaceRootPath: string,
  projectRoot?: string
): string {
  const rootLockFile = parseJson<BunLockFile>(rootLockFileContent, {
    allowTrailingComma: true,
    expectComments: true,
  });
  if (!rootLockFile?.packages || !rootLockFile.workspaces) {
    throw new Error(
      'Pruned lock file creation failed. The root bun.lock has no "packages" or "workspaces" section.'
    );
  }
  const rootPackages = rootLockFile.packages;
  const hasRootPackage = (key: string) =>
    Object.prototype.hasOwnProperty.call(rootPackages, key);
  const localSources = getBunLocalPathSources(rootLockFile);
  const workspacePackages = getWorkspacePackagesFromGraph(graph);
  const resolvesToWorkspaceModule = (
    name: string,
    spec: string,
    dependentRoot: string | undefined
  ) =>
    !!resolveWorkspaceModuleDependency(
      workspacePackages,
      name,
      spec,
      dependentRoot,
      workspaceRootPath
    );
  const catalogManager = getCatalogManager(workspaceRootPath);
  const resolveCatalog = (name: string, spec: string) => {
    if (!catalogManager?.isCatalogReference(spec)) {
      return spec;
    }
    const resolved = catalogManager.resolveCatalogReference(
      workspaceRootPath,
      name,
      spec
    );
    if (!resolved) {
      throw new Error(
        `Could not resolve catalog reference for ${name}@${spec}.`
      );
    }
    return resolved;
  };

  // `shippedSpec` is the spec the dependent's shipped manifest declares the
  // package under.
  const createPackage = (
    key: string,
    shippedSpec?: string
  ): Omit<PrunedPackage, 'path'> => {
    const tuple = rootPackages[key] as unknown[];
    const resolution = tuple?.[0];
    if (typeof resolution !== 'string') {
      throw new Error(
        `Pruned lock file creation failed. The root lock file has an invalid entry for "${key}".`
      );
    }
    const source = localSources.get(key);
    if (source) {
      const shippedResolution = getShippedLocalResolution(
        resolution,
        source,
        shippedSpec
      );
      return {
        resolution: shippedResolution,
        tuple: [shippedResolution, ...tuple.slice(1)],
        rootScope: splitBunPackageKey(key),
        dependencies: extractPackageDependencies(tuple),
        isWorkspaceModule: false,
      };
    }
    const { protocol } = getCachedSpecInfo(resolution);
    if (LOCAL_RESOLUTION_PROTOCOLS.has(protocol)) {
      throw new Error(
        `Pruned lock file creation failed. ${resolution} is a local package that the pruned output does not ship.`
      );
    }
    return {
      resolution,
      tuple,
      rootScope: splitBunPackageKey(key),
      dependencies: extractPackageDependencies(tuple),
      isWorkspaceModule: false,
    };
  };

  // Mirrors the manifest copy-workspace-modules writes for the copy: catalog
  // references resolved and sibling modules pointed at their copies (a peer one
  // moved into dependencies). A frozen install takes a folder dependency's
  // dependencies from this entry, so leaving out devDependencies keeps Bun
  // from installing them, or failing on a `workspace:` one the copy keeps.
  const getShippedModuleDependencies = (
    name: string,
    workspacePath: string,
    workspace: Workspace
  ): PackageDependencies => {
    const shipped: PackageDependencies = {};
    for (const depType of DEPENDENCY_TYPES) {
      if (depType === 'devDependencies') {
        continue;
      }
      for (const [dep, spec] of Object.entries(workspace[depType] ?? {})) {
        if (resolvesToWorkspaceModule(dep, spec, workspacePath)) {
          const section =
            depType === 'peerDependencies' ? 'dependencies' : depType;
          (shipped[section] ??= {})[dep] = `file:${posix.relative(
            `workspace_modules/${name}`,
            `workspace_modules/${dep}`
          )}`;
        } else {
          // Bun resolves a folder dependency's local specs from its own
          // directory, so they follow the copy.
          const resolved = resolveCatalog(dep, spec);
          const relocation = relocatePrunedLocalPathSpec(
            resolved,
            workspacePath,
            `workspace_modules/${name}`
          );
          (shipped[depType] ??= {})[dep] =
            relocation && !relocation.reason ? relocation.spec : resolved;
        }
      }
    }
    const optionalPeers = workspace.optionalPeers?.filter(
      (peer) => shipped.peerDependencies?.[peer]
    );
    if (optionalPeers?.length) {
      shipped.optionalPeers = optionalPeers;
    }
    return sortDependencyGroups(shipped);
  };

  // Bun records a folder dependency of a folder dependency without its
  // dependencies and never installs them, so a nested module is not expanded.
  const createWorkspaceModule = (
    name: string,
    nested: boolean
  ): Omit<PrunedPackage, 'path'> => {
    const resolution = `${name}@file:workspace_modules/${name}`;
    if (nested) {
      return { resolution, tuple: [resolution, {}], isWorkspaceModule: true };
    }
    const [workspacePath, workspace] =
      Object.entries(rootLockFile.workspaces).find(
        ([path, entry]) => path !== '' && entry.name === name
      ) ?? [];
    if (!workspace) {
      throw new Error(
        `Pruned lock file creation failed. The workspace package ${name} was not found in the root lock file.`
      );
    }
    return {
      resolution,
      tuple: [
        resolution,
        getShippedModuleDependencies(name, workspacePath, workspace),
      ],
      rootScope: [name],
      dependencies: workspace,
      isWorkspaceModule: true,
      workspacePath,
    };
  };

  const placed = new Map<string, PrunedPackage>();
  const queue: PrunedPackage[] = [];
  const place = (
    dependentPath: string[],
    name: string,
    pkg: Omit<PrunedPackage, 'path'>,
    nestUnderDependent = false
  ) => {
    const reachedKey = findNearestBunPackageKey(dependentPath, name, (key) =>
      placed.has(key)
    );
    if (placed.get(reachedKey)?.resolution === pkg.resolution) {
      return;
    }
    // The hoisted slot is safe while no key on the dependent's path resolves
    // the name. Otherwise nesting under the dependent shadows nothing, because
    // its subtree only gains packages as its own dependencies are placed here.
    const path =
      reachedKey || nestUnderDependent ? [...dependentPath, name] : [name];
    const prunedPackage = { ...pkg, path };
    placed.set(path.join('/'), prunedPackage);
    queue.push(prunedPackage);
  };
  // Bun lists a tarball's bundled tree under the bundler, as the tarball lays it
  // out, so that subtree keeps its root lockfile layout.
  const placeBundled = (
    bundle: NonNullable<PrunedPackage['bundle']>,
    pkg: Omit<PrunedPackage, 'path'>
  ) => {
    const path = [
      ...bundle.path,
      ...pkg.rootScope.slice(bundle.rootScope.length),
    ];
    const key = path.join('/');
    const existing = placed.get(key);
    if (existing) {
      if (existing.resolution !== pkg.resolution) {
        throw new Error(
          `Pruned lock file creation failed. ${pkg.resolution}, bundled by ${bundle.path.join('/')}, conflicts with ${existing.resolution}.`
        );
      }
      return;
    }
    const prunedPackage = { ...pkg, path, bundle };
    placed.set(key, prunedPackage);
    queue.push(prunedPackage);
  };

  const rootWorkspace: Workspace = {};
  // A createPackageJson manifest is named after the project, which need not be
  // a workspace, and the name could match a package nested in the root lockfile.
  const appScope =
    packageJson.name &&
    Object.entries(rootLockFile.workspaces).some(
      ([path, entry]) => path !== '' && entry.name === packageJson.name
    )
      ? [packageJson.name]
      : [];
  const placedRootDependencies = new Set<string>();
  for (const depType of DEPENDENCY_TYPES) {
    for (const [name, spec] of Object.entries(packageJson[depType] ?? {})) {
      const isWorkspaceModule = resolvesToWorkspaceModule(
        name,
        spec,
        projectRoot
      );
      if (isWorkspaceModule) {
        // Matches the manifest prune-lockfile writes, which also moves a
        // peer-declared module into dependencies.
        const section =
          depType === 'peerDependencies' ? 'dependencies' : depType;
        (rootWorkspace[section] ??= {})[name] =
          `file:./workspace_modules/${name}`;
      } else {
        (rootWorkspace[depType] ??= {})[name] = spec;
      }
      if (placedRootDependencies.has(name)) {
        continue;
      }
      placedRootDependencies.add(name);
      if (isWorkspaceModule) {
        place([], name, createWorkspaceModule(name, false));
        continue;
      }
      if (
        depType === 'peerDependencies' &&
        packageJson.peerDependenciesMeta?.[name]?.optional
      ) {
        continue;
      }
      const resolvedSpec = resolveCatalog(name, spec);
      const key = findManifestDependencyKey(
        rootPackages,
        localSources,
        appScope,
        name,
        resolvedSpec
      );
      if (key) {
        place([], name, createPackage(key, resolvedSpec));
      } else if (depType !== 'optionalDependencies') {
        throw new Error(
          `Pruned lock file creation failed. The following package was not found in the root lock file: ${name}@${spec}`
        );
      }
    }
  }
  // Bun writes no lockfile for a manifest without dependencies, and a frozen
  // install rejects any lockfile there.
  if (DEPENDENCY_TYPES.every((depType) => !rootWorkspace[depType])) {
    return '';
  }
  const optionalRootPeers = Object.keys(rootWorkspace.peerDependencies ?? {})
    .filter((name) => packageJson.peerDependenciesMeta?.[name]?.optional)
    .sort(compareStrings);
  if (optionalRootPeers.length) {
    rootWorkspace.optionalPeers = optionalRootPeers;
  }

  for (let i = 0; i < queue.length; i++) {
    const pkg = queue[i];
    if (!pkg.rootScope) {
      continue;
    }
    const seen = new Set<string>();
    for (const depType of DEPENDENCY_TYPES) {
      if (pkg.isWorkspaceModule && depType === 'devDependencies') {
        continue;
      }
      for (const name of Object.keys(pkg.dependencies?.[depType] ?? {})) {
        if (seen.has(name)) {
          continue;
        }
        seen.add(name);
        if (
          pkg.isWorkspaceModule &&
          resolvesToWorkspaceModule(
            name,
            pkg.dependencies[depType][name],
            pkg.workspacePath
          )
        ) {
          place(pkg.path, name, createWorkspaceModule(name, true), true);
          continue;
        }
        const key = findNearestBunPackageKey(
          pkg.rootScope,
          name,
          hasRootPackage
        );
        // An optional peer the root lockfile resolves is kept, in range or
        // not, since the package loads that copy in the workspace.
        if (key) {
          const dependency = createPackage(
            key,
            extractPackageDependencies(pkg.tuple)?.[depType]?.[name]
          );
          const bundle =
            pkg.bundle &&
            isNestedUnder(dependency.rootScope, pkg.bundle.rootScope)
              ? pkg.bundle
              : dependency.dependencies?.bundled &&
                  isNestedUnder(dependency.rootScope, pkg.rootScope)
                ? { rootScope: pkg.rootScope, path: pkg.path }
                : undefined;
          if (bundle) {
            placeBundled(bundle, dependency);
          } else {
            place(pkg.path, name, dependency);
          }
        } else if (
          depType !== 'optionalDependencies' &&
          depType !== 'peerDependencies'
        ) {
          throw new Error(
            `Pruned lock file creation failed. ${name}, a dependency of ${pkg.resolution}, was not found in the root lock file.`
          );
        }
      }
    }
  }

  const workspace: Workspace = {
    ...(packageJson.name && { name: packageJson.name }),
    ...sortDependencyGroups(rootWorkspace),
  };
  const overrides = getPrunedOverrides(rootLockFile.overrides, packageJson);
  const trustedDependencies = getPrunedTrustedDependencies(
    packageJson.trustedDependencies,
    rootLockFile.trustedDependencies,
    new Set(
      [...placed.values()].map(
        ({ resolution }) => getCachedSpecInfo(resolution).name
      )
    )
  );
  const patchedDependencies = getPrunedPatchedDependencies(
    rootLockFile.patchedDependencies,
    new Set([...placed.values()].map(({ resolution }) => resolution))
  );
  const packages = [...placed.values()]
    .sort(comparePrunedPackages)
    .map(
      ({ path, tuple }) =>
        `    ${JSON.stringify(path.join('/'))}: ${formatInlineBunLockfileValue(tuple)},`
    );

  const lines = ['{', `  "lockfileVersion": ${rootLockFile.lockfileVersion},`];
  if (rootLockFile.configVersion !== undefined) {
    lines.push(`  "configVersion": ${rootLockFile.configVersion},`);
  }
  lines.push(
    `  "workspaces": ${formatBunLockfileValue({ '': workspace }, '  ')},`
  );
  if (trustedDependencies) {
    lines.push(
      `  "trustedDependencies": ${formatBunLockfileValue(trustedDependencies, '  ')},`
    );
  }
  if (patchedDependencies) {
    lines.push(
      `  "patchedDependencies": ${formatBunLockfileValue(patchedDependencies, '  ')},`
    );
  }
  if (overrides) {
    lines.push(`  "overrides": ${formatBunLockfileValue(overrides, '  ')},`);
  }
  lines.push(
    packages.length
      ? ['  "packages": {', packages.join('\n\n'), '  }'].join('\n')
      : '  "packages": {}',
    '}',
    ''
  );
  return lines.join('\n');
}

// A scoped name (`@scope/name`) is one segment.
function splitBunPackageKey(key: string): string[] {
  const parts = key.split('/');
  const segments: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    segments.push(
      parts[i].startsWith('@') && i + 1 < parts.length
        ? `${parts[i]}/${parts[++i]}`
        : parts[i]
    );
  }
  return segments;
}

function isNestedUnder(key: string[], scope: string[]): boolean {
  return (
    key.length > scope.length && scope.every((segment, i) => key[i] === segment)
  );
}

function findNearestBunPackageKey(
  scope: string[],
  name: string,
  hasKey: (key: string) => boolean
): string | undefined {
  for (let depth = scope.length; depth >= 0; depth--) {
    const key = [...scope.slice(0, depth), name].join('/');
    if (hasKey(key)) {
      return key;
    }
  }
}

/**
 * The root lockfile key for a dependency of the pruned manifest: the app's own
 * resolution when it matches the manifest's spec. A dependency the manifest
 * took from one of the app's workspace libraries (createPackageJson collects
 * those) can resolve under that library's scope instead, so the shallowest key
 * matching the spec is used otherwise. A local package matches by the source
 * the relocated spec names.
 */
function findManifestDependencyKey(
  packages: BunLockFile['packages'],
  localSources: Map<string, BunLocalPathSource>,
  appScope: string[],
  name: string,
  spec: string
): string | undefined {
  const local = getLocalSpecSource(spec);
  const matches = (key: string) => {
    if (!local) {
      return resolvesToSpec(packages[key], spec);
    }
    const source = localSources.get(key);
    return (
      source?.path === local.path &&
      (source.kind === 'link') === (local.protocol === 'link')
    );
  };
  const key = findNearestBunPackageKey(appScope, name, (candidate) =>
    Object.prototype.hasOwnProperty.call(packages, candidate)
  );
  if (key && matches(key)) {
    return key;
  }
  let match: string[] | undefined;
  for (const candidate of Object.keys(packages)) {
    const segments = splitBunPackageKey(candidate);
    if (
      segments[segments.length - 1] === name &&
      (!match || segments.length < match.length) &&
      matches(candidate)
    ) {
      match = segments;
    }
  }
  return match?.join('/');
}

// The workspace source a relocated `file:`/`link:` spec of the pruned manifest
// names.
function getLocalSpecSource(
  spec: string
): { protocol: 'file' | 'link'; path: string } | undefined {
  const protocol = spec.startsWith('file:')
    ? 'file'
    : spec.startsWith('link:')
      ? 'link'
      : undefined;
  if (!protocol) {
    return undefined;
  }
  return {
    protocol,
    path: normalizeBunLocalPath(
      uncontainLocalPathSpec(spec).slice(protocol.length + 1)
    ),
  };
}

/**
 * A local package's resolution once its source ships under
 * `local_path_modules/`, which Bun records as it would for the output. A
 * tarball's path is relative to its dependent, so it is the path the
 * dependent's shipped spec declares. A source the output cannot ship keeps
 * its resolution.
 */
function getShippedLocalResolution(
  resolution: string,
  source: BunLocalPathSource,
  shippedSpec: string | undefined
): string {
  const { name } = getCachedSpecInfo(resolution);
  if (source.kind === 'tarball') {
    return shippedSpec?.startsWith('file:')
      ? `${name}@${normalizeBunLocalPath(shippedSpec.slice('file:'.length))}`
      : resolution;
  }
  const relocation = relocatePrunedLocalPathSpec(`file:${source.path}`, '', '');
  if (relocation.reason) {
    return resolution;
  }
  const shippedPath = relocation.spec.slice('file:'.length);
  return source.kind === 'link'
    ? `${name}@link:./${shippedPath}`
    : `${name}@file:${shippedPath}`;
}

// Only a semver range is checked: a git, tarball or tag spec trusts the
// lockfile's resolution.
function resolvesToSpec(tuple: unknown[], spec: string): boolean {
  if (typeof tuple?.[0] !== 'string') {
    return false;
  }
  let range = spec;
  let aliasedName: string | undefined;
  if (spec.startsWith('npm:')) {
    const versionAt = spec.lastIndexOf('@');
    aliasedName = versionAt > 4 ? spec.slice(4, versionAt) : spec.slice(4);
    range = versionAt > 4 ? spec.slice(versionAt + 1) : '*';
  }
  if (!validRange(range)) {
    return true;
  }
  const { name, version } = getCachedSpecInfo(tuple[0]);
  return (
    (aliasedName === undefined || name === aliasedName) &&
    satisfies(version, range)
  );
}

// Bun records the manifest's trusted names that are installed. Bun picks its
// own order, which a frozen install does not check, so this keeps the
// manifest's. An empty manifest list is `[]` in a Bun 1.4.4 lockfile and
// absent in earlier ones, so it follows the root lockfile.
function getPrunedTrustedDependencies(
  declared: string[] | undefined,
  rootTrusted: string[] | undefined,
  installed: Set<string>
): string[] | undefined {
  if (!declared) {
    return undefined;
  }
  if (!declared.length) {
    return rootTrusted?.length === 0 ? [] : undefined;
  }
  const kept = declared.filter((name) => installed.has(name));
  return kept.length ? kept : undefined;
}

/**
 * The `.patch` files a pruned Bun output ships for the patches its bun.lock
 * keeps. Bun applies the patches the manifest declares, so the same entries
 * replace any `patchedDependencies` the manifest inherited.
 */
export function getPrunedBunPatchArtifacts(
  workspaceRootPath: string,
  lockFileContent: string,
  packageJson: PackageJson
): Array<{ path: string; content: string }> {
  delete packageJson.patchedDependencies;
  const rootPackageJsonPath = join(workspaceRootPath, 'package.json');
  const keys = getBunLockfilePatchKeys(lockFileContent);
  if (!keys.length || !existsSync(rootPackageJsonPath)) {
    return [];
  }
  const rootPatches =
    readJsonFile<PackageJson>(rootPackageJsonPath).patchedDependencies ?? {};
  const scoped = Object.fromEntries(
    keys.filter((key) => rootPatches[key]).map((key) => [key, rootPatches[key]])
  );
  if (!Object.keys(scoped).length) {
    return [];
  }
  packageJson.patchedDependencies = normalizePrunedPatchedDependencies(scoped);
  return getPrunedPatchFiles(workspaceRootPath, scoped);
}

/**
 * The local packages a pruned bun.lock installs, which the output ships under
 * `local_path_modules/` (see `getLocalPathArtifacts`). Copied workspace modules
 * ship through copy-workspace-modules instead.
 */
export function getPrunedBunLocalPathTargets(
  lockFileContent: string
): LocalPathArtifactTarget[] {
  if (!lockFileContent) {
    return [];
  }
  const lockFile = parseJson<BunLockFile>(lockFileContent, {
    allowTrailingComma: true,
    expectComments: true,
  });
  const targets: LocalPathArtifactTarget[] = [];
  for (const [key, source] of getBunLocalPathSources(lockFile)) {
    if (!isUnderWorkspaceModules(source.path)) {
      targets.push({
        kind: source.kind === 'tarball' ? 'file' : 'directory',
        shippedPath: source.path,
        origin: lockFile.packages[key][0] as string,
      });
    }
  }
  return targets;
}

/**
 * Fails the pruned build when a `link:` package of the pruned bun.lock requires
 * a dependency the app does not install. Bun installs no dependencies of a
 * link, which loads them from the install root.
 */
export function validatePrunedBunLocalPathClosure(
  packageJson: PackageJson,
  workspaceRootPath: string,
  lockFileContent: string
): void {
  if (!lockFileContent) {
    return;
  }
  const lockFile = parseJson<BunLockFile>(lockFileContent, {
    allowTrailingComma: true,
    expectComments: true,
  });
  const targets = new Map<string, 'link'>();
  for (const source of getBunLocalPathSources(lockFile).values()) {
    if (source.kind === 'link') {
      targets.set(uncontainLocalPath(source.path), 'link');
    }
  }
  validateLocalPathClosures(packageJson, workspaceRootPath, targets);
}

/**
 * Hashes the patch files the root package.json declares, keyed by the declared
 * path. bun.lock records only the path, so these hashes are what change when a
 * patch file does. A missing file gets its own hash, apart from an unpatched
 * package's.
 */
export function getBunPatchFileHashes(
  workspaceRootPath: string
): Map<string, string> {
  const hashes = new Map<string, string>();
  const rootPackageJsonPath = join(workspaceRootPath, 'package.json');
  if (!existsSync(rootPackageJsonPath)) {
    return hashes;
  }
  const { patchedDependencies } =
    readJsonFile<PackageJson>(rootPackageJsonPath);
  for (const patchPath of Object.values(patchedDependencies ?? {})) {
    if (typeof patchPath !== 'string' || hashes.has(patchPath)) {
      continue;
    }
    const source = isAbsolute(patchPath)
      ? patchPath
      : join(workspaceRootPath, patchPath);
    hashes.set(
      patchPath,
      fileExists(source)
        ? hashFile(source)
        : hashArray([`missing patch ${patchPath}`])
    );
  }
  return hashes;
}

export function getBunLockfilePatchKeys(lockFileContent: string): string[] {
  if (!lockFileContent) {
    return [];
  }
  const { patchedDependencies } = parseJson<BunLockFile>(lockFileContent, {
    allowTrailingComma: true,
    expectComments: true,
  });
  return Object.keys(patchedDependencies ?? {});
}

// Bun records only the patches of installed packages, keyed by `name@version`.
// They point at the paths the output ships the patch files under.
function getPrunedPatchedDependencies(
  patchedDependencies: BunLockFile['patchedDependencies'],
  installed: Set<string>
): Record<string, string> | undefined {
  const kept = Object.fromEntries(
    Object.entries(patchedDependencies ?? {}).filter(([key]) =>
      installed.has(key)
    )
  );
  return Object.keys(kept).length
    ? normalizePrunedPatchedDependencies(kept)
    : undefined;
}

// Bun reads `overrides` when the manifest has it and `resolutions` otherwise,
// stripping a `**/` prefix. A frozen install fails from Bun 1.4 when the
// lockfile's overrides differ from the manifest's, so only the root entries the
// pruned manifest still declares are kept.
function getPrunedOverrides(
  overrides: BunLockFile['overrides'],
  packageJson: NormalizedPackageJson
): BunLockFile['overrides'] | undefined {
  const declared = packageJson.overrides ?? packageJson.resolutions;
  if (!overrides || !declared) {
    return undefined;
  }
  const declaredNames = new Set(
    Object.keys(declared).map((key) =>
      key.startsWith('**/') ? key.slice(3) : key
    )
  );
  const kept = Object.entries(overrides).filter(([name]) =>
    declaredNames.has(name)
  );
  return kept.length ? Object.fromEntries(kept) : undefined;
}

function sortDependencyGroups(
  groups: PackageDependencies
): PackageDependencies {
  const sorted: PackageDependencies = {};
  for (const depType of DEPENDENCY_TYPES) {
    if (groups[depType]) {
      sorted[depType] = Object.fromEntries(
        Object.entries(groups[depType]).sort(([a], [b]) => compareStrings(a, b))
      );
    }
  }
  if (groups.optionalPeers) {
    sorted.optionalPeers = groups.optionalPeers;
  }
  return sorted;
}

// Bun's order: by depth, then by the dependent's path, then by name.
function comparePrunedPackages(a: PrunedPackage, b: PrunedPackage): number {
  return (
    a.path.length - b.path.length ||
    compareStrings(
      a.path.slice(0, -1).join('/'),
      b.path.slice(0, -1).join('/')
    ) ||
    compareStrings(a.path[a.path.length - 1], b.path[b.path.length - 1])
  );
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Bun's multi-line layout: two-space indent and a comma after every entry.
function formatBunLockfileValue(value: unknown, indent: string): string {
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    return value.length
      ? `[\n${value
          .map((item) => `${inner}${formatBunLockfileValue(item, inner)},\n`)
          .join('')}${indent}]`
      : '[]';
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length
      ? `{\n${entries
          .map(
            ([key, item]) =>
              `${inner}${JSON.stringify(key)}: ${formatBunLockfileValue(item, inner)},\n`
          )
          .join('')}${indent}}`
      : '{}';
  }
  return JSON.stringify(value);
}

// Bun's single-line layout for a `packages` entry.
function formatInlineBunLockfileValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(formatInlineBunLockfileValue).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length
      ? `{ ${entries
          .map(
            ([key, item]) =>
              `${JSON.stringify(key)}: ${formatInlineBunLockfileValue(item)}`
          )
          .join(', ')} }`
      : '{}';
  }
  return JSON.stringify(value);
}
