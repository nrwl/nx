import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { satisfies } from 'semver';
import {
  DependencyType,
  type ProjectGraphExternalNode,
  type ProjectGraph,
} from '../../../config/project-graph';
import { hashArray } from '../../../hasher/file-hasher';
import type { CreateDependenciesContext } from '../../../project-graph/plugins';
import {
  type RawProjectGraphDependency,
  validateDependency,
} from '../../../project-graph/project-graph-builder';
import { parseJson } from '../../../utils/json';
import type { NormalizedPackageJson } from './utils/package-json';

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
  /** Version of the lockfile format (currently 0 or 1) */
  lockfileVersion: number;

  /**
   * Workspaces configuration - maps workspace paths to their dependencies
   * Empty string "" represents the root workspace
   */
  workspaces: Record<string, Workspace>;

  /**
   * Package definitions - maps package identifiers to package metadata
   */
  packages: Record<string, PackageTuple>;

  /**
   * Patched dependencies configuration
   * Maps package names to patch file information
   */
  patches?: Record<string, PatchedDependency>;

  /**
   * Registry manifests cache
   * Stores resolved package metadata from registries
   */
  manifests?: Record<string, RegistryManifest>;

  /**
   * Workspace package metadata
   * Information about local workspace packages
   */
  workspacePackages?: Record<string, WorkspacePackageInfo>;
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

// Git package: ["name@git:repo", metadata, tag]
type GitPackageTuple = [string, PackageDependencies, string];

// NPM package: ["name@version", tarballUrl, metadata, hash]
type NpmPackageTuple = [string, string, PackageDependencies, string];

interface PackageDependencies {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface PatchedDependency {
  /** Path to the patch file (e.g., "patches/package-name@1.0.0.patch") */
  path: string;
}

interface RegistryManifest {
  /** Package version */
  version: string;

  /** Distribution information */
  dist: {
    /** SHA hash for integrity */
    shasum: string;
  };
}

interface WorkspacePackageInfo {
  /** Package name */
  name: string;

  /** Package version */
  version: string;

  /** Relative path from workspace root */
  path: string;
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
  // Set of all workspace package names (from workspacePackages + workspace: deps)
  workspaceNames: Set<string>;
  // Set of all workspace paths
  workspacePaths: Set<string>;
  // Set of packages that have workspace-specific variants
  packagesWithWorkspaceVariants: Set<string>;
  // Set of patched package names
  patchedPackages: Set<string>;
}

export const BUN_LOCK_FILE = 'bun.lockb';
export const BUN_TEXT_LOCK_FILE = 'bun.lock';

let currentLockFileHash: string;
let cachedParsedLockFile: BunLockFile;
let cachedPackageIndex: PackageIndex;

const keyMap = new Map<string, ProjectGraphExternalNode>();
const packageVersions = new Map<string, Set<string>>();
const specParseCache = new Map<
  string,
  { name: string; version: string; protocol: string }
>();

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
    windowsHide: false,
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
  packageVersions.clear();
  specParseCache.clear();
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

  // Handle specs without protocol prefix (e.g., "package@1.0.0" instead of "package@npm:1.0.0")
  if (colonIndex === -1) {
    // No protocol specified, treat as npm package with direct version
    return { name, version: protocolAndSpec };
  }

  const protocol = protocolAndSpec.substring(0, colonIndex);
  const spec = protocolAndSpec.substring(colonIndex + 1);

  if (protocol === 'npm') {
    // For npm protocol, spec should always be in format: package@version
    // Examples:
    // - Regular: "package@npm:package@1.0.0" -> version: "1.0.0"
    // - Alias: "alias@npm:real-package@1.0.0" -> version: "npm:real-package@1.0.0"

    // Extract the package name and version from the spec
    const atIndex = spec.lastIndexOf('@');
    if (atIndex === -1) {
      // Malformed spec, return as-is
      return { name, version: spec };
    }

    const specPackageName = spec.substring(0, atIndex);
    const specVersion = spec.substring(atIndex + 1);

    if (specPackageName === name) {
      // Regular npm package: "package@npm:package@1.0.0" -> version: "1.0.0"
      return { name, version: specVersion };
    } else {
      // Alias package: "alias@npm:real-package@1.0.0" -> version: "npm:real-package@1.0.0"
      return { name, version: `npm:${spec}` };
    }
  } else if (protocol === 'workspace') {
    // Workspace dependencies use the workspace path as version
    return { name, version: `workspace:${spec}` };
  } else if (protocol === 'github' || protocol === 'git') {
    // Extract commit hash from GitHub/Git reference
    // Format: user/repo#commit-hash or repo-url#commit-hash
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

function calculatePackageHash(
  packageData: PackageTuple,
  lockFile: BunLockFile,
  name: string,
  version: string
): string {
  const [resolvedSpec, tarballUrl, metadata, hash] = packageData;

  // For NPM packages (4 elements), use the integrity hash
  if (packageData.length === 4 && hash && typeof hash === 'string') {
    // Use better hash from manifests if available
    if (lockFile.manifests && lockFile.manifests[`${name}@${version}`]) {
      const manifest = lockFile.manifests[`${name}@${version}`];
      if (manifest.dist && manifest.dist.shasum) {
        return manifest.dist.shasum;
      }
    }
    return hash;
  }

  // For other package types, calculate hash from available data
  const hashData = [resolvedSpec];
  if (tarballUrl && typeof tarballUrl === 'string') hashData.push(tarballUrl);
  if (metadata) hashData.push(JSON.stringify(metadata));
  if (hash && typeof hash === 'string') hashData.push(hash);

  return hashArray(hashData);
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
  const patchedPackages = new Set<string>();

  // Collect workspace paths
  if (lockFile.workspaces) {
    for (const workspacePath of Object.keys(lockFile.workspaces)) {
      if (workspacePath !== '') {
        workspacePaths.add(workspacePath);
      }
    }
  }

  // Collect workspace package names from workspacePackages field
  if (lockFile.workspacePackages) {
    for (const packageInfo of Object.values(lockFile.workspacePackages)) {
      workspaceNames.add(packageInfo.name);
    }
  }

  // Collect patched package names
  if (lockFile.patches) {
    for (const packageName of Object.keys(lockFile.patches)) {
      patchedPackages.add(packageName);
    }
  }

  // Collect workspace package names from workspace dependencies
  if (lockFile.workspaces) {
    for (const workspace of Object.values(lockFile.workspaces)) {
      const allDeps = {
        ...workspace.dependencies,
        ...workspace.devDependencies,
        ...workspace.optionalDependencies,
        ...workspace.peerDependencies,
      };
      for (const [depName, depVersion] of Object.entries(allDeps)) {
        if (
          depVersion.startsWith('workspace:') ||
          depVersion.startsWith('file:')
        ) {
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
      if (protocol === 'workspace' || protocol === 'file') {
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
      const hash = calculatePackageHash(
        packageData as PackageTuple,
        lockFile,
        name,
        version
      );

      entries.push({ version, packageKey, hash });
    }
  }

  return {
    byName,
    workspaceNames,
    workspacePaths,
    packagesWithWorkspaceVariants,
    patchedPackages,
  };
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

      const supportedVersions = [0, 1];
      if (!supportedVersions.includes(result.lockfileVersion)) {
        throw new Error(
          `Unsupported lockfile version ${
            result.lockfileVersion
          }. Supported versions: ${supportedVersions.join(', ')}`
        );
      }
    }

    if (!result.packages || typeof result.packages !== 'object') {
      throw new Error('Lockfile packages section must be an object');
    }

    if (!result.workspaces || typeof result.workspaces !== 'object') {
      throw new Error('Lockfile workspaces section must be an object');
    }

    // Validate optional sections
    if (result.patches && typeof result.patches !== 'object') {
      throw new Error('Lockfile patches section must be an object');
    }

    if (result.manifests && typeof result.manifests !== 'object') {
      throw new Error('Lockfile manifests section must be an object');
    }

    if (
      result.workspacePackages &&
      typeof result.workspacePackages !== 'object'
    ) {
      throw new Error('Lockfile workspacePackages section must be an object');
    }

    // Validate structure of patches entries
    if (result.patches) {
      for (const [packageName, patchInfo] of Object.entries(result.patches)) {
        if (!patchInfo || typeof patchInfo !== 'object') {
          throw new Error(
            `Invalid patch entry for package "${packageName}": must be an object`
          );
        }
        if (!patchInfo.path || typeof patchInfo.path !== 'string') {
          throw new Error(
            `Invalid patch entry for package "${packageName}": path must be a string`
          );
        }
      }
    }

    // Validate structure of workspace packages entries
    if (result.workspacePackages) {
      for (const [packageName, packageInfo] of Object.entries(
        result.workspacePackages
      )) {
        if (!packageInfo || typeof packageInfo !== 'object') {
          throw new Error(
            `Invalid workspace package entry for "${packageName}": must be an object`
          );
        }
        if (!packageInfo.name || typeof packageInfo.name !== 'string') {
          throw new Error(
            `Invalid workspace package entry for "${packageName}": name must be a string`
          );
        }
        if (!packageInfo.version || typeof packageInfo.version !== 'string') {
          throw new Error(
            `Invalid workspace package entry for "${packageName}": version must be a string`
          );
        }
      }
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

export function getBunTextLockfileNodes(
  lockFileContent: string,
  lockFileHash: string
): Record<string, ProjectGraphExternalNode> {
  try {
    const { lockFile, index } = parseLockFile(lockFileContent, lockFileHash);

    const nodes: Record<string, ProjectGraphExternalNode> = {};
    const localPackageVersions = new Map<string, Set<string>>();

    if (!lockFile.packages || Object.keys(lockFile.packages).length === 0) {
      return nodes;
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
        localPackageVersions
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
  packageVersions: Map<string, Set<string>>
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

    if (index.patchedPackages.has(name)) {
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
            hash: calculatePackageHash(
              packageData as PackageTuple,
              lockFile,
              aliasName,
              `npm:${actualPackageName}@${actualVersion}`
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
            hash: calculatePackageHash(
              packageData as PackageTuple,
              lockFile,
              actualPackageName,
              actualVersion
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

      const nodeHash = calculatePackageHash(
        packageData as PackageTuple,
        lockFile,
        name,
        version
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

function isWorkspaceOrPatchedPackage(
  packageName: string,
  index: PackageIndex,
  workspacePackages: Set<string>
): boolean {
  return (
    workspacePackages.has(packageName) ||
    index.workspaceNames.has(packageName) ||
    index.patchedPackages.has(packageName)
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
  // O(1) checks using index
  if (
    index.workspaceNames.has(packageKey) ||
    isNestedPackageKey(packageKey, index)
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

  if (index.patchedPackages.has(sourcePackageName)) {
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
      sourceNodeName,
      index,
      ctx,
      workspacePackages,
      lockFile.manifests
    );
    dependencies.push(...depDependencies);
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
  sourceNodeName: string,
  index: PackageIndex,
  ctx: CreateDependenciesContext,
  workspacePackages: Set<string>,
  manifests?: BunLockFile['manifests']
): RawProjectGraphDependency[] {
  const dependencies: RawProjectGraphDependency[] = [];
  const depsEntries = Object.entries(deps);

  for (const [packageName, versionSpec] of depsEntries) {
    try {
      const dependency = processSingleDependency(
        packageName,
        versionSpec,
        sourceNodeName,
        index,
        ctx,
        workspacePackages,
        manifests
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
  sourceNodeName: string,
  index: PackageIndex,
  ctx: CreateDependenciesContext,
  workspacePackages: Set<string>,
  manifests?: BunLockFile['manifests']
): RawProjectGraphDependency | null {
  if (typeof packageName !== 'string' || typeof versionSpec !== 'string') {
    return null;
  }

  // O(1) check using index
  if (isWorkspaceOrPatchedPackage(packageName, index, workspacePackages)) {
    return null;
  }

  if (versionSpec.startsWith('workspace:')) {
    return null;
  }

  let targetPackageName = packageName;
  let targetVersion = versionSpec;

  const aliasTarget = resolveAliasTarget(versionSpec);
  if (aliasTarget) {
    targetPackageName = aliasTarget.packageName;
    targetVersion = aliasTarget.version;
  } else {
    // O(1) lookup using index instead of O(n) scan
    const resolvedVersion = findResolvedVersion(
      packageName,
      versionSpec,
      index,
      manifests
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
  // If the key doesn't contain '/', it's a direct package entry
  if (!packageKey.includes('/')) {
    return false;
  }

  // Check if this looks like a workspace-specific or nested entry
  const parts = packageKey.split('/');

  // For multi-part keys, check if the prefix is a workspace path or package name
  if (parts.length >= 2) {
    const prefix = parts.slice(0, -1).join('/');

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
    // where parts.length === 2 and first part starts with '@', it's likely
    // a scoped package alias, not a nested dependency
    if (parts.length === 2 && parts[0].startsWith('@')) {
      return false;
    }

    // This could be dependency nesting (e.g., "is-even/is-odd")
    // These should be filtered out as they're not direct packages
    return true;
  }

  return false;
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
  index: PackageIndex,
  manifests?: BunLockFile['manifests']
): string | null {
  // O(1) lookup
  const candidates = index.byName.get(packageName);
  if (!candidates || candidates.length === 0) {
    // Try to find in manifests as fallback
    if (manifests) {
      const exactManifestKey = `${packageName}@${versionSpec}`;
      if (manifests[exactManifestKey]) {
        return versionSpec;
      }

      const manifestKey = Object.keys(manifests).find((key) =>
        key.startsWith(`${packageName}@`)
      );
      if (manifestKey) {
        const manifest = manifests[manifestKey];
        if (manifest.version) {
          return manifest.version;
        }
      }
    }
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

  // Return the highest satisfying version (similar to npm behavior)
  // Sort versions in descending order and return the first one
  const sortedVersions = satisfyingVersions.sort((a, b) => {
    try {
      return b.version.localeCompare(a.version, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    } catch {
      // Fallback to string comparison
      return b.version.localeCompare(a.version);
    }
  });

  return sortedVersions[0].version;
}

/**
 * Creates a stringified Bun lockfile from a project graph and package.json
 * This function serializes the external nodes and dependencies into Bun's lockfile format
 */
export function stringifyBunLockfile(
  graph: ProjectGraph,
  rootLockFileContent: string,
  packageJson: NormalizedPackageJson
): string {
  try {
    // Parse the existing lockfile to maintain structure and metadata
    const existingLockfile = parseLockFile(rootLockFileContent, '');

    // Get workspace packages to skip them in the output
    const workspacePackages = new Set<string>();

    // Add the root package name if it exists
    if (packageJson.name) {
      workspacePackages.add(packageJson.name);
    }

    // Get workspace package names from the existing lockfile
    if (existingLockfile.workspacePackages) {
      for (const packageInfo of Object.values(
        existingLockfile.workspacePackages
      )) {
        workspacePackages.add(packageInfo.name);
      }
    }

    // Also check workspaces dependencies for workspace: protocol packages
    if (existingLockfile.workspaces) {
      for (const workspace of Object.values(existingLockfile.workspaces)) {
        const allDeps = {
          ...workspace.dependencies,
          ...workspace.devDependencies,
          ...workspace.peerDependencies,
          ...workspace.optionalDependencies,
        };
        for (const [depName, depVersion] of Object.entries(allDeps || {})) {
          if (
            typeof depVersion === 'string' &&
            depVersion.startsWith('workspace:')
          ) {
            workspacePackages.add(depName);
          }
        }
      }
    }

    // Create the new lockfile structure, preserving existing metadata
    const newLockfile: BunLockFile = {
      lockfileVersion: existingLockfile.lockfileVersion || 1,
      workspaces: existingLockfile.workspaces || {},
      packages: {},
    };

    // Preserve optional sections if they exist
    if (existingLockfile.patches) {
      newLockfile.patches = existingLockfile.patches;
    }
    if (existingLockfile.manifests) {
      newLockfile.manifests = existingLockfile.manifests;
    }
    if (existingLockfile.workspacePackages) {
      newLockfile.workspacePackages = existingLockfile.workspacePackages;
    }

    // Add external nodes from the graph as packages
    for (const [nodeName, node] of Object.entries(graph.externalNodes)) {
      if (
        node.type === 'npm' &&
        !workspacePackages.has(node.data.packageName)
      ) {
        const packageName = node.data.packageName;
        const version = node.data.version;

        // Create the package key - check if this should be hoisted (package name only) or versioned
        // If the original lockfile has the package with just the name, preserve that structure
        const originalHoistedData = findOriginalBunPackageData(
          existingLockfile.packages || {},
          packageName,
          version
        );

        const packageKey =
          existingLockfile.packages && existingLockfile.packages[packageName]
            ? packageName // Use hoisted name if it exists in original
            : `${packageName}@${version}`; // Otherwise use versioned name

        // Find original package data if it exists in the root lockfile
        const originalPackageData = findOriginalBunPackageData(
          existingLockfile.packages || {},
          packageName,
          version
        );

        if (originalPackageData) {
          // Use existing package data to preserve integrity hashes and metadata
          newLockfile.packages[packageKey] = originalPackageData;
        } else {
          // Create minimal package entry for new packages
          const resolvedSpec = `${packageName}@npm:${version}`;
          const tarballUrl = `https://registry.npmjs.org/${packageName}/-/${packageName}-${version}.tgz`;

          // Create NPM package tuple: [resolvedSpec, tarballUrl, metadata, hash]
          const packageTuple: NpmPackageTuple = [
            resolvedSpec,
            tarballUrl,
            {}, // Empty metadata - will be filled by bun install
            node.data.hash || 'placeholder-hash',
          ];

          newLockfile.packages[packageKey] = packageTuple;
        }
      }
    }

    // Update workspace dependencies in the root workspace
    if (newLockfile.workspaces['']) {
      const rootWorkspace = newLockfile.workspaces[''];

      // Add dependencies from package.json to workspace only if they exist and are non-empty
      if (
        packageJson.dependencies &&
        Object.keys(packageJson.dependencies).length > 0
      ) {
        rootWorkspace.dependencies = {
          ...rootWorkspace.dependencies,
          ...packageJson.dependencies,
        };
      }
      if (
        packageJson.devDependencies &&
        Object.keys(packageJson.devDependencies).length > 0
      ) {
        rootWorkspace.devDependencies = {
          ...rootWorkspace.devDependencies,
          ...packageJson.devDependencies,
        };
      }
      if (
        packageJson.peerDependencies &&
        Object.keys(packageJson.peerDependencies).length > 0
      ) {
        rootWorkspace.peerDependencies = {
          ...rootWorkspace.peerDependencies,
          ...packageJson.peerDependencies,
        };
      }
      if (
        packageJson.optionalDependencies &&
        Object.keys(packageJson.optionalDependencies).length > 0
      ) {
        rootWorkspace.optionalDependencies = {
          ...rootWorkspace.optionalDependencies,
          ...packageJson.optionalDependencies,
        };
      }
    } else {
      // Create root workspace if it doesn't exist
      const rootWorkspace: Workspace = {};

      // Only add non-empty dependency sections
      if (
        packageJson.dependencies &&
        Object.keys(packageJson.dependencies).length > 0
      ) {
        rootWorkspace.dependencies = packageJson.dependencies;
      }
      if (
        packageJson.devDependencies &&
        Object.keys(packageJson.devDependencies).length > 0
      ) {
        rootWorkspace.devDependencies = packageJson.devDependencies;
      }
      if (
        packageJson.peerDependencies &&
        Object.keys(packageJson.peerDependencies).length > 0
      ) {
        rootWorkspace.peerDependencies = packageJson.peerDependencies;
      }
      if (
        packageJson.optionalDependencies &&
        Object.keys(packageJson.optionalDependencies).length > 0
      ) {
        rootWorkspace.optionalDependencies = packageJson.optionalDependencies;
      }

      newLockfile.workspaces[''] = rootWorkspace;
    }

    // Sort package keys for consistent output
    const sortedPackages: Record<string, PackageTuple> = {};
    Object.keys(newLockfile.packages)
      .sort()
      .forEach((key) => {
        sortedPackages[key] = newLockfile.packages[key];
      });
    newLockfile.packages = sortedPackages;

    // Serialize to JSON with trailing commas (Bun's JSONC format)
    return JSON.stringify(newLockfile, null, 2) + '\n';
  } catch (error) {
    throw new Error(`Failed to stringify Bun lockfile: ${error.message}`);
  }
}

/**
 * Finds original package data from the existing lockfile
 */
function findOriginalBunPackageData(
  packages: Record<string, PackageTuple>,
  packageName: string,
  version: string
): PackageTuple | null {
  // Try exact package name match first (for hoisted packages)
  if (packages[packageName]) {
    const packageData = packages[packageName];
    if (Array.isArray(packageData) && packageData.length > 0) {
      const [resolvedSpec] = packageData;
      if (typeof resolvedSpec === 'string') {
        const { name, version: resolvedVersion } =
          getCachedSpecInfo(resolvedSpec);
        if (name === packageName && resolvedVersion === version) {
          return packageData;
        }
      }
    }
  }

  // Try versioned package name
  const versionedKey = `${packageName}@${version}`;
  if (packages[versionedKey]) {
    return packages[versionedKey];
  }

  // Search through all packages for a match
  for (const [key, packageData] of Object.entries(packages)) {
    if (Array.isArray(packageData) && packageData.length > 0) {
      const [resolvedSpec] = packageData;
      if (typeof resolvedSpec === 'string') {
        const { name, version: resolvedVersion } =
          getCachedSpecInfo(resolvedSpec);
        if (name === packageName && resolvedVersion === version) {
          return packageData;
        }
      }
    }
  }

  return null;
}
