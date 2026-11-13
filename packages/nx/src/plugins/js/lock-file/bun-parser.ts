import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, posix } from 'node:path';
import { satisfies } from 'semver';
import {
  DependencyType,
  type ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { hashArray, hashFile } from '../../../hasher/file-hasher';
import type { CreateDependenciesContext } from '../../../project-graph/plugins';
import {
  type RawProjectGraphDependency,
  validateDependency,
} from '../../../project-graph/project-graph-builder';
import { fileExists, readJsonFile } from '../../../utils/fileutils';
import { parseJson } from '../../../utils/json';
import type { PackageJson } from '../../../utils/package-json';

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

  /**
   * Version rules from the root package.json "overrides"/"resolutions".
   * Values are version specs, or (lockfileVersion 3) objects of rules scoped
   * to the dependencies of the package named by the key. Not used by this
   * parser: the resolutions they produce are already reflected in `packages`.
   */
  overrides?: Record<string, string | Record<string, string>>;

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
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
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
  // - "package-name@github:user/repo#commit"
  // - "package-name@file:./path"
  // - "package-name@https://example.com/package.tgz"

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

function parseBunLockFile(lockFileContent: string): BunLockFile {
  return parseJson<BunLockFile>(lockFileContent, {
    allowTrailingComma: true,
    expectComments: true,
  });
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
    const result = parseBunLockFile(lockFileContent);

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
    const aliasTarget = resolveAliasTarget(node.data.version);
    const sources = sourcesByResolution.get(
      aliasTarget
        ? `${aliasTarget.packageName}@${aliasTarget.version}`
        : `${node.data.packageName}@${node.data.version}`
    );
    if (sources) {
      nodeSources[node.name] = [...sources].sort();
    }
  }
  return nodeSources;
}

/**
 * The local-path node each workspace installs per dependency name, keyed by
 * its path ('.' for the root). Aliases are left out.
 */
export function getBunInstalledLocalPathNodes(
  lockFileContent: string,
  lockFileHash: string,
  nodes: Record<string, ProjectGraphExternalNode>
): Record<string, Record<string, string>> {
  const { lockFile, index } = parseLockFile(lockFileContent, lockFileHash);
  const installed: Record<string, Record<string, string>> = {};
  if (!index.localPathSources.size) {
    return installed;
  }
  const packages = lockFile.packages ?? {};
  const hasKey = (key: string) =>
    Object.prototype.hasOwnProperty.call(packages, key);
  for (const [path, workspace] of Object.entries(lockFile.workspaces ?? {})) {
    // Bun keys a workspace's nested packages by its name
    if (path !== '' && !workspace.name) {
      continue;
    }
    const scope = path === '' ? [] : [workspace.name];
    for (const depType of DEPENDENCY_TYPES) {
      for (const depName of Object.keys(workspace[depType] ?? {})) {
        const key = findNearestBunPackageKey(scope, depName, hasKey);
        if (key === undefined || !index.localPathSources.has(key)) {
          continue;
        }
        const { name, version } = getCachedSpecInfo(packages[key][0] as string);
        const node = nodes[`npm:${name}@${version}`];
        if (name === depName && node) {
          (installed[path || '.'] ??= {})[depName] = node.name;
        }
      }
    }
  }
  return installed;
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

    // O(1) lookups using index. A local package can share a workspace
    // package's name, and only its path tells whether it installs that one.
    if (
      index.workspaceNames.has(name) &&
      !isNonWorkspaceLocalPackage(packageKey, index)
    ) {
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
      const hash = withPatchHash(
        calculatePackageHash(packageData as PackageTuple),
        patchHashes.get(`${actualPackageName}@${actualVersion}`)
      );

      const aliasNodeKey = `npm:${aliasName}`;
      if (!keyMap.has(aliasNodeKey)) {
        const aliasNode: ProjectGraphExternalNode = {
          type: 'npm',
          name: aliasNodeKey,
          data: {
            version: `npm:${actualPackageName}@${actualVersion}`,
            packageName: aliasName,
            hash,
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
            hash,
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

function isNonWorkspaceLocalPackage(
  packageKey: string,
  index: PackageIndex
): boolean {
  const source = index.localPathSources.get(packageKey);
  return source !== undefined && !index.workspacePaths.has(source.path);
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

  // A local package can share a workspace package's name, and only the path
  // this parent resolved it to tells whether it installs that one.
  if (
    isWorkspacePackage(packageName, index, workspacePackages) &&
    !isNonWorkspaceLocalPackage(`${sourcePackageKey}/${packageName}`, index)
  ) {
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
    // The workspace package of that name is the one installed at the root
    if (index.workspaceNames.has(packageName)) {
      continue;
    }
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

// A bun.lock key is the package's path in the hoisted tree (`a/b` is `b` nested
// under `a`), and a dependency resolves to the nearest key on its dependent's
// path. A workspace's scope is its name, so `<workspace name>/<name>` comes first.
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
