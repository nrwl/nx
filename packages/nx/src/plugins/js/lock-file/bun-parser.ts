import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { satisfies } from 'semver';
import {
  DependencyType,
  type ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { hashArray } from '../../../hasher/file-hasher';
import type { CreateDependenciesContext } from '../../../project-graph/plugins';
import {
  type RawProjectGraphDependency,
  type StaticDependency,
  validateDependency,
} from '../../../project-graph/project-graph-builder';
import { parseJson } from '../../../utils/json';

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

export const BUN_LOCK_FILE = 'bun.lockb';
export const BUN_TEXT_LOCK_FILE = 'bun.lock';

let currentLockFileHash: string;
let cachedParsedLockFile: BunLockFile;

// Cache to avoid duplicate work when parsing keys
let keyMap = new Map<string, ProjectGraphExternalNode>();
let packageVersions = new Map<string, Set<string>>();

// Structured error types for better error handling
export class BunLockfileParseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
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

export function getBunTextLockfileNodes(
  lockFileContent: string,
  lockFileHash: string
): Record<string, ProjectGraphExternalNode> {
  try {
    const lockFile = parseLockFile(lockFileContent, lockFileHash);

    const nodes: Record<string, ProjectGraphExternalNode> = {};
    const packageVersions = new Map<string, Set<string>>();

    if (!lockFile.packages || Object.keys(lockFile.packages).length === 0) {
      return nodes;
    }

    const packageEntries = Object.entries(lockFile.packages);

    for (let i = 0; i < packageEntries.length; i++) {
      const [packageKey, packageData] = packageEntries[i];
      try {
        if (
          !Array.isArray(packageData) ||
          packageData.length < 1 ||
          packageData.length > 4
        ) {
          const warningMessage = `Invalid package data format for ${packageKey}: expected 1-4 elements, got ${JSON.stringify(
            packageData
          )}`;
          console.warn(warningMessage);
          continue;
        }

        const [resolvedSpec] = packageData;

        if (typeof resolvedSpec !== 'string') {
          const warningMessage = `Invalid resolved spec for ${packageKey}: expected string, got ${typeof resolvedSpec}`;
          console.warn(warningMessage);
          continue;
        }

        // Extract package name and version from resolved spec
        const { name, version } = parseResolvedSpec(resolvedSpec);

        if (!name || !version) {
          const warningMessage = `Could not parse package name and version from resolved spec: ${resolvedSpec}`;
          console.warn(warningMessage);
          continue;
        }

        // Skip workspace packages
        if (isWorkspacePackage(name, lockFile)) {
          continue;
        }

        // Skip patched packages - they don't become external nodes
        // Similar to how yarn parser handles patches
        if (lockFile.patches && lockFile.patches[name]) {
          continue;
        }

        // Handle different tuple formats based on protocol
        const protocol = getProtocolFromResolvedSpec(resolvedSpec);

        // Skip workspace packages at the protocol level
        if (protocol === 'workspace') {
          continue;
        }

        // Handle alias packages - identify by comparing package key with resolved spec name
        if (isAliasPackage(packageKey, name)) {
          // For aliases, packageKey is the alias name, name is the actual package name
          const aliasName = packageKey;
          const actualPackageName = name;
          const actualVersion = version;

          // Create alias node (npm:alias-name)
          const aliasNodeKey = `npm:${aliasName}`;
          if (!keyMap.has(aliasNodeKey)) {
            const aliasNode: ProjectGraphExternalNode = {
              type: 'npm',
              name: aliasNodeKey,
              data: {
                version: `npm:${actualPackageName}@${actualVersion}`,
                packageName: aliasName,
                hash: calculatePackageHash(
                  packageData,
                  lockFile,
                  aliasName,
                  `npm:${actualPackageName}@${actualVersion}`
                ),
              },
            };
            keyMap.set(aliasNodeKey, aliasNode);
            nodes[aliasNodeKey] = aliasNode;
          }

          // Create target node (npm:actual-package@actual-version)
          const targetNodeKey = `npm:${actualPackageName}@${actualVersion}`;
          if (!keyMap.has(targetNodeKey)) {
            const targetNode: ProjectGraphExternalNode = {
              type: 'npm',
              name: targetNodeKey,
              data: {
                version: actualVersion,
                packageName: actualPackageName,
                hash: calculatePackageHash(
                  packageData,
                  lockFile,
                  actualPackageName,
                  actualVersion
                ),
              },
            };
            keyMap.set(targetNodeKey, targetNode);
            nodes[targetNodeKey] = targetNode;
          }

          // Track both alias and target for hoisting logic
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
          // Handle regular packages
          // Track package versions for hoisting logic
          if (!packageVersions.has(name)) {
            packageVersions.set(name, new Set());
          }
          packageVersions.get(name).add(version);

          const nodeKey = `npm:${name}@${version}`;

          if (keyMap.has(nodeKey)) {
            nodes[nodeKey] = keyMap.get(nodeKey);
            continue;
          }

          // Calculate hash based on tuple format
          let nodeHash = calculatePackageHash(
            packageData,
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
      } catch (error) {
        const warningMessage = `Failed to process package ${packageKey}: ${error.message}`;
        console.warn(warningMessage);
        continue;
      }
    }

    // Create hoisted nodes for packages that are likely to be hoisted
    // In Bun workspaces, packages shared across workspaces are hoisted to root
    for (const [packageName, versions] of packageVersions.entries()) {
      const hoistedNodeKey = `npm:${packageName}`;

      // Check if this package appears in multiple workspaces (candidate for hoisting)
      if (shouldCreateHoistedNode(packageName, lockFile)) {
        // Find the version that would be hoisted (typically the highest satisfying version)
        const hoistedVersion = findHoistedVersion(
          packageName,
          versions,
          lockFile
        );
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

    return nodes;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get Bun lockfile nodes: ${error.message}`);
  }
}

export function getBunTextLockfileDependencies(
  lockFileContent: string,
  lockFileHash: string,
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  try {
    const lockFile = parseLockFile(lockFileContent, lockFileHash);

    const dependencies: RawProjectGraphDependency[] = [];
    const workspacePackages = new Set(Object.keys(ctx.projects));

    // Early return for empty workspaces
    if (!lockFile.workspaces || Object.keys(lockFile.workspaces).length === 0) {
      return dependencies;
    }

    // Pre-compute workspace package names for performance
    const workspacePackageNames = new Set<string>();
    if (lockFile.workspacePackages) {
      for (const packageName of Object.keys(lockFile.workspacePackages)) {
        workspacePackageNames.add(packageName);
      }
    }

    // Process workspace dependencies
    const workspaceEntries = Object.entries(lockFile.workspaces);
    for (let i = 0; i < workspaceEntries.length; i++) {
      const [workspaceName, workspace] = workspaceEntries[i];
      try {
        if (!workspace || typeof workspace !== 'object') {
          const warningMessage = `Invalid workspace format for ${workspaceName}: expected object, got ${typeof workspace}`;
          console.warn(warningMessage);
          continue;
        }

        const sourceProject = workspaceName === '' ? '' : workspaceName;

        // Process each dependency type - using array for better performance
        const depTypes = [
          'dependencies',
          'devDependencies',
          'optionalDependencies',
          'peerDependencies',
        ] as const;

        for (let j = 0; j < depTypes.length; j++) {
          const depType = depTypes[j];
          const deps = workspace[depType];
          if (!deps || typeof deps !== 'object') continue;

          const depsEntries = Object.entries(deps);
          for (let k = 0; k < depsEntries.length; k++) {
            const [packageName, versionSpec] = depsEntries[k];
            try {
              if (
                typeof packageName !== 'string' ||
                typeof versionSpec !== 'string'
              ) {
                const detailedError = `Invalid dependency format in '${workspaceName}.${depType}': ${packageName}@${versionSpec}. Expected both name and version to be strings.`;
                console.warn(`[Bun Parser] ${detailedError}`);
                continue;
              }

              // Handle optional peer dependencies
              if (
                depType === 'peerDependencies' &&
                workspace.peerDependenciesMeta
              ) {
                const peerMeta = workspace.peerDependenciesMeta[packageName];
                if (peerMeta && peerMeta.optional) {
                  // Skip optional peer dependencies that are not explicitly installed
                  // This matches the behavior from npm/yarn where optional peers are only
                  // included if they're already present in the dependency graph
                  if (!ctx.externalNodes[`npm:${packageName}`]) {
                    continue;
                  }
                }
              }

              // Skip patched dependencies in dependency resolution
              // Patched packages are tracked but don't create direct dependencies
              if (lockFile.patches && lockFile.patches[packageName]) {
                continue;
              }

              // Skip workspace packages using enhanced detection
              if (
                workspacePackages.has(packageName) ||
                workspacePackageNames.has(packageName) ||
                isWorkspacePackage(packageName, lockFile)
              ) {
                continue;
              }

              // Skip workspace dependencies (marked with "workspace:" prefix)
              if (versionSpec.startsWith('workspace:')) {
                continue;
              }

              // Handle alias dependencies - resolve to the actual target package
              let targetPackageName = packageName;
              let targetVersion = versionSpec;

              if (versionSpec.startsWith('npm:')) {
                // This is an alias dependency - extract the actual package name and version
                const actualSpec = versionSpec.substring(4); // Remove 'npm:' prefix
                const actualAtIndex = actualSpec.lastIndexOf('@');
                const actualPackageName = actualSpec.substring(
                  0,
                  actualAtIndex
                );
                const actualVersion = actualSpec.substring(actualAtIndex + 1);

                targetPackageName = actualPackageName;
                targetVersion = actualVersion;
              } else {
                // Find the resolved version from packages using enhanced resolution
                const resolvedVersion = findResolvedVersion(
                  packageName,
                  versionSpec,
                  lockFile.packages,
                  lockFile.manifests
                );

                if (!resolvedVersion) {
                  const warningMessage = `Could not find resolved version for ${packageName}@${versionSpec} in workspace ${workspaceName}`;
                  console.warn(warningMessage);
                  continue;
                }

                targetVersion = resolvedVersion;
              }

              const dependency: StaticDependency = {
                source: sourceProject,
                target: `npm:${targetPackageName}@${targetVersion}`,
                type: DependencyType.static,
                sourceFile: 'bun.lock', // Lockfile dependencies come from the lockfile
              };

              try {
                validateDependency(dependency, ctx);
                dependencies.push(dependency);
              } catch (e) {
                const warningMessage = `Failed to validate dependency ${packageName}: ${e.message}`;
                console.warn(warningMessage);
                continue;
              }
            } catch (error) {
              const warningMessage = `Failed to process dependency ${packageName} in ${workspaceName}.${depType}: ${error.message}`;
              console.warn(warningMessage);
              continue;
            }
          }
        }
      } catch (error) {
        const warningMessage = `Failed to process workspace ${workspaceName}: ${error.message}`;
        console.warn(warningMessage);
        continue;
      }
    }

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

// Helper functions

/**
 * @internal used for testing
 */
export function clearCache(): void {
  currentLockFileHash = undefined;
  cachedParsedLockFile = undefined;
  keyMap.clear();
  packageVersions.clear();
}

function parseLockFile(
  lockFileContent: string,
  lockFileHash: string
): BunLockFile {
  if (currentLockFileHash === lockFileHash) {
    return cachedParsedLockFile;
  }

  keyMap.clear();
  packageVersions.clear();

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

    return result;
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

function isWorkspacePackage(
  packageName: string,
  lockFile: BunLockFile
): boolean {
  // Check if package is in workspacePackages field
  if (lockFile.workspacePackages && lockFile.workspacePackages[packageName]) {
    return true;
  }

  // Check if package is defined in any workspace dependencies with workspace: prefix
  // or if it's a file dependency in workspace dependencies
  if (lockFile.workspaces) {
    for (const workspace of Object.values(lockFile.workspaces)) {
      const allDeps = {
        ...workspace.dependencies,
        ...workspace.devDependencies,
        ...workspace.optionalDependencies,
        ...workspace.peerDependencies,
      };
      if (allDeps[packageName]?.startsWith('workspace:')) {
        return true;
      }
      // Check if this is a file dependency defined in workspace dependencies
      // Always filter out file dependencies as they represent workspace packages
      if (allDeps[packageName]?.startsWith('file:')) {
        return true;
      }
    }
  }

  // Check if package appears in packages section with workspace: or file: protocol
  if (lockFile.packages) {
    for (const packageData of Object.values(lockFile.packages)) {
      if (Array.isArray(packageData) && packageData.length > 0) {
        const resolvedSpec = packageData[0];
        if (typeof resolvedSpec === 'string') {
          const { name } = parseResolvedSpec(resolvedSpec);
          const protocol = getProtocolFromResolvedSpec(resolvedSpec);
          if (
            name === packageName &&
            (protocol === 'workspace' || protocol === 'file')
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

function findResolvedVersion(
  packageName: string,
  versionSpec: string,
  packages: BunLockFile['packages'],
  manifests?: BunLockFile['manifests']
): string | null {
  // Look for matching packages and collect all versions
  const candidateVersions: {
    version: string;
    packageKey: string;
    manifest?: RegistryManifest;
  }[] = [];
  const packageEntries = Object.entries(packages);

  // Early optimization: if we have manifests, try to find exact match first
  if (manifests) {
    const exactManifestKey = `${packageName}@${versionSpec}`;
    if (manifests[exactManifestKey]) {
      return versionSpec;
    }
  }

  for (let i = 0; i < packageEntries.length; i++) {
    const [packageKey, packageData] = packageEntries[i];
    const [resolvedSpec] = packageData;

    // Skip non-string specs early
    if (typeof resolvedSpec !== 'string') {
      continue;
    }

    // Only parse the resolved spec if it's needed
    const { name, version } = parseResolvedSpec(resolvedSpec);

    if (name === packageName) {
      // Include manifest information if available
      const manifest = manifests?.[`${name}@${version}`];
      candidateVersions.push({ version, packageKey, manifest });
    }

    // Check for alias packages where this package might be the target
    if (isAliasPackage(packageKey, name) && name === packageName) {
      // This alias points to the package we're looking for
      const manifest = manifests?.[`${name}@${version}`];
      candidateVersions.push({ version, packageKey, manifest });
    }
  }

  if (candidateVersions.length === 0) {
    // Try to find in manifests as fallback
    if (manifests) {
      const manifestKey = Object.keys(manifests).find((key) =>
        key.startsWith(`${packageName}@`)
      );
      if (manifestKey) {
        const manifest = manifests[manifestKey];
        const version = manifest.version;
        if (version) {
          candidateVersions.push({
            version,
            packageKey: manifestKey,
            manifest,
          });
        }
      }
    }

    if (candidateVersions.length === 0) {
      return null;
    }
  }

  // Handle different version specification patterns with enhanced logic
  const bestMatch = findBestVersionMatch(
    packageName,
    versionSpec,
    candidateVersions
  );
  return bestMatch ? bestMatch.version : null;
}

/**
 * Find the best version match for a given version specification
 * Implements logic similar to npm/yarn for complex version ranges
 */
function findBestVersionMatch(
  packageName: string,
  versionSpec: string,
  candidates: {
    version: string;
    packageKey: string;
    manifest?: RegistryManifest;
  }[]
): { version: string; packageKey: string; manifest?: RegistryManifest } | null {
  // For exact matches, return immediately
  const exactMatch = candidates.find((c) => c.version === versionSpec);
  if (exactMatch) {
    return exactMatch;
  }

  // Handle union ranges (||)
  if (versionSpec.includes('||')) {
    const ranges = versionSpec.split('||').map((r) => r.trim());
    for (const range of ranges) {
      const match = findBestVersionMatch(packageName, range, candidates);
      if (match) {
        return match;
      }
    }
    return null;
  }

  // Handle non-semver versions (git, file, etc.)
  const nonSemverVersions = candidates.filter(
    (c) => !c.version.match(/^\d+\.\d+\.\d+/)
  );
  if (nonSemverVersions.length > 0) {
    // For non-semver versions, use the first match or exact match
    const nonSemverMatch = nonSemverVersions.find(
      (c) => c.version === versionSpec
    );
    if (nonSemverMatch) {
      return nonSemverMatch;
    }
    // If no exact match, return the first non-semver candidate
    return nonSemverVersions[0];
  }

  // Handle semver versions
  const semverVersions = candidates.filter((c) =>
    c.version.match(/^\d+\.\d+\.\d+/)
  );
  if (semverVersions.length === 0) {
    return candidates[0]; // Fallback to any available version
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
    // No satisfying versions found, return the first candidate as fallback
    return semverVersions[0];
  }

  // Return the highest satisfying version (similar to npm behavior)
  // Sort versions in descending order and return the first one
  const sortedVersions = satisfyingVersions.sort((a, b) => {
    try {
      // Use semver comparison if possible
      const aVersion = a.version.match(/^\d+\.\d+\.\d+/) ? a.version : '0.0.0';
      const bVersion = b.version.match(/^\d+\.\d+\.\d+/) ? b.version : '0.0.0';
      return aVersion.localeCompare(bVersion, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    } catch {
      // Fallback to string comparison
      return b.version.localeCompare(a.version);
    }
  });

  return sortedVersions[0];
}

/**
 * Determines if a package should have a hoisted node created
 * In Bun workspaces, packages that appear in multiple workspaces are hoisted
 */
function shouldCreateHoistedNode(
  packageName: string,
  lockFile: BunLockFile
): boolean {
  if (!lockFile.workspaces) return false;

  let workspaceCount = 0;

  for (const workspace of Object.values(lockFile.workspaces)) {
    const allDeps = {
      ...workspace.dependencies,
      ...workspace.devDependencies,
      ...workspace.optionalDependencies,
      ...workspace.peerDependencies,
    };

    if (allDeps[packageName]) {
      workspaceCount++;
      if (workspaceCount > 1) {
        return true; // Found in multiple workspaces, should be hoisted
      }
    }
  }

  return false;
}

/**
 * Finds the version that would be hoisted for a given package
 * This is typically the highest version that satisfies all workspace requirements
 */
function findHoistedVersion(
  packageName: string,
  availableVersions: Set<string>,
  lockFile: BunLockFile
): string | null {
  if (!lockFile.workspaces) return null;

  const workspaceVersionSpecs: string[] = [];

  // Collect all version specifications from workspaces
  for (const workspace of Object.values(lockFile.workspaces)) {
    const allDeps = {
      ...workspace.dependencies,
      ...workspace.devDependencies,
      ...workspace.optionalDependencies,
      ...workspace.peerDependencies,
    };

    if (allDeps[packageName]) {
      workspaceVersionSpecs.push(allDeps[packageName]);
    }
  }

  if (workspaceVersionSpecs.length === 0) return null;

  // Find the highest version that satisfies all workspace requirements
  const availableVersionsArray = Array.from(availableVersions);
  const semverVersions = availableVersionsArray.filter((v) =>
    v.match(/^\d+\.\d+\.\d+/)
  );

  if (semverVersions.length === 0) {
    return availableVersionsArray[0]; // Return first non-semver version
  }

  // Sort versions in descending order
  const sortedVersions = semverVersions
    .sort((a, b) => {
      try {
        return a.localeCompare(b, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      } catch {
        return b.localeCompare(a);
      }
    })
    .reverse();

  // Find the highest version that satisfies all workspace requirements
  for (const version of sortedVersions) {
    const satisfiesAll = workspaceVersionSpecs.every((spec) => {
      try {
        return satisfies(version, spec);
      } catch {
        return version === spec;
      }
    });

    if (satisfiesAll) {
      return version;
    }
  }

  // If no version satisfies all requirements, return the highest version
  return sortedVersions[0];
}
