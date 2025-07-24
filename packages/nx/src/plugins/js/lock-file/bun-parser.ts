import {
  DependencyType,
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { hashArray } from '../../../hasher/file-hasher';
import {
  RawProjectGraphDependency,
  validateDependency,
} from '../../../project-graph/project-graph-builder';
import { CreateDependenciesContext } from '../../../project-graph/plugins';
import { NormalizedPackageJson } from './utils/package-json';
import { getWorkspacePackagesFromGraph } from '../utils/get-workspace-packages-from-graph';

/**
 * Bun lock file structure based on JSON format
 *
 * Structure varies between binary (bun.lockb) and text (bun.lock) formats:
 * - Binary format (bun.lockb): Optimized binary format (legacy)
 * - Text format (bun.lock): JSON with trailing commas (default since v1.2)
 *
 * References:
 * - https://bun.sh/blog/bun-lock-text-lockfile
 * - https://bun.sh/docs/install/lockfile
 */

type BunDependency = {
  resolution: {
    type: string;
    registry?: string;
    tarball?: string;
    specifier?: string; // Can include workspace:*, file:, link: protocols
  };
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  version?: string;
  name?: string;
};

// Type definition for Bun lockfile structure
// Currently focused on binary format (bun.lockb) for compatibility
// The new text format (bun.lock) has different structure but we parse as JSON
type BunLockFile = {
  lockfileVersion: number;
  workspaces?: Record<string, any>;
  packages?: Record<string, BunDependency>;
  // Additional metadata that might be present
  [key: string]: any;
};

let currentLockFileHash: string;
let parsedLockFile: BunLockFile;

function parseBunLockFile(lockFileContent: string, lockFileHash: string) {
  if (lockFileHash === currentLockFileHash && parsedLockFile) {
    return parsedLockFile;
  }

  try {
    // Try parsing as JSON first (text format)
    const results = JSON.parse(lockFileContent) as BunLockFile;
    parsedLockFile = results;
    currentLockFileHash = lockFileHash;
    return results;
  } catch (e) {
    // If JSON parsing fails, try removing trailing commas (common in Bun lockfiles)
    try {
      const cleanedContent = lockFileContent.replace(/,(\s*[}\]])/g, '$1'); // Remove trailing commas before } and ]
      const results = JSON.parse(cleanedContent) as BunLockFile;
      parsedLockFile = results;
      currentLockFileHash = lockFileHash;
      return results;
    } catch (cleanupError) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Failed to parse Bun lockfile. Original error: ${errorMessage}. ` +
          `Cleanup attempt failed: ${
            cleanupError instanceof Error
              ? cleanupError.message
              : String(cleanupError)
          }`
      );
    }
  }
}

export function getBunLockfileNodes(
  lockFileContent: string,
  lockFileHash: string
): Record<string, ProjectGraphExternalNode> {
  try {
    const data = parseBunLockFile(lockFileContent, lockFileHash);
    // Create a fresh keyMap for this parsing session
    const localKeyMap = new Map<string, ProjectGraphExternalNode>();
    return getNodes(data, localKeyMap);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to get Bun lockfile nodes: ${errorMessage}`);
  }
}

export function getBunLockfileDependencies(
  lockFileContent: string,
  lockFileHash: string,
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  try {
    const data = parseBunLockFile(lockFileContent, lockFileHash);
    const dependencies: RawProjectGraphDependency[] = [];

    if (data.packages) {
      for (const [packageKey, packageData] of Object.entries(data.packages)) {
        // Skip if packageData is not in expected format (e.g., array format from text lockfile)
        if (Array.isArray(packageData)) {
          continue;
        }

        const externalNodeName = getExternalNodeName(packageKey, packageData);

        // Process all dependency types supported by Bun
        // Reference: https://bun.sh/docs/cli/install (Bun supports all standard npm dependency types)
        const depTypes = [
          { deps: packageData.dependencies, type: DependencyType.static },
          {
            deps: packageData.optionalDependencies,
            type: DependencyType.static,
          },
          { deps: packageData.devDependencies, type: DependencyType.static },
          { deps: packageData.peerDependencies, type: DependencyType.static },
        ];

        for (const { deps, type } of depTypes) {
          if (deps) {
            for (const [depName, depVersion] of Object.entries(deps)) {
              // First try to find the dependency with version specifier
              let targetExists =
                ctx.externalNodes[`npm:${depName}@${depVersion}`];

              // If not found, try without version (hoisted)
              if (!targetExists) {
                targetExists = ctx.externalNodes[`npm:${depName}`];
              }

              // If still not found, search for any matching package name
              if (!targetExists) {
                for (const node of Object.values(ctx.externalNodes)) {
                  if (node.data.packageName === depName) {
                    targetExists = node;
                    break;
                  }
                }
              }

              if (targetExists) {
                const dependency: RawProjectGraphDependency = {
                  source: externalNodeName,
                  target: targetExists.name,
                  type,
                } as RawProjectGraphDependency;

                validateDependency(dependency, ctx);
                dependencies.push(dependency);
              }
            }
          }
        }
      }
    }

    return dependencies;
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    throw new Error(`Failed to get Bun lockfile dependencies: ${errorMessage}`);
  }
}

function getNodes(
  data: BunLockFile,
  keyMap: Map<string, ProjectGraphExternalNode>
): Record<string, ProjectGraphExternalNode> {
  const nodes: Map<string, Map<string, ProjectGraphExternalNode>> = new Map();
  const results: Record<string, ProjectGraphExternalNode> = {};

  if (data.packages) {
    for (const [packageKey, packageData] of Object.entries(data.packages)) {
      // Skip if packageData is not in expected format (e.g., array format from text lockfile)
      if (Array.isArray(packageData)) {
        continue;
      }

      // Skip workspace packages
      // Bun uses workspace:* protocol for monorepo dependencies
      // References: https://bun.sh/docs/install/workspaces
      if (
        packageData.resolution?.specifier?.startsWith('file:') ||
        packageData.resolution?.specifier?.startsWith('link:') ||
        packageData.resolution?.specifier?.startsWith('workspace:') ||
        packageData.resolution?.type === 'workspace'
      ) {
        continue;
      }

      const packageName = packageData.name || getPackageNameFromKey(packageKey);
      const version = packageData.version || getVersionFromKey(packageKey);
      const externalNodeName = `npm:${packageName}@${version}`;

      if (!nodes.has(packageName)) {
        nodes.set(packageName, new Map());
      }

      if (!nodes.get(packageName).has(version)) {
        const node: ProjectGraphExternalNode = {
          type: 'npm',
          name: externalNodeName,
          data: {
            version,
            packageName,
            hash: hashArray([packageKey, JSON.stringify(packageData)]),
          },
        };
        nodes.get(packageName).set(version, node);
        keyMap.set(externalNodeName, node);
      }
    }
  }

  // Handle package hoisting
  // Bun uses hoisted installation by default but specific hoisting algorithm is undocumented
  // - https://bun.sh/docs/install/isolated
  for (const [packageName, versionMap] of nodes.entries()) {
    if (versionMap.size === 1) {
      // Only one version exists, treat as hoisted
      const hoistedNode = versionMap.values().next().value;
      hoistedNode.name = `npm:${packageName}`;
    }

    // Add all versions to results
    versionMap.forEach((node) => {
      results[node.name] = node;
    });
  }

  return results;
}

function getExternalNodeName(packageKey: string, packageData: any): string {
  const packageName = packageData.name || getPackageNameFromKey(packageKey);
  const version = packageData.version || getVersionFromKey(packageKey);
  return `npm:${packageName}@${version}`;
}

function getPackageNameFromKey(packageKey: string): string {
  // Handle scoped packages like @types/node@1.0.0
  if (packageKey.startsWith('@')) {
    const parts = packageKey.split('@');
    if (parts.length >= 3) {
      return `@${parts[1]}`;
    }
    // Handle edge case where package is just @scope
    return packageKey;
  }

  // Handle regular packages like react@18.0.0
  const atIndex = packageKey.lastIndexOf('@');
  if (atIndex > 0) {
    return packageKey.substring(0, atIndex);
  }

  return packageKey;
}

function getVersionFromKey(packageKey: string): string {
  // Handle scoped packages like @types/node@1.0.0
  if (packageKey.startsWith('@')) {
    const parts = packageKey.split('@');
    if (parts.length >= 3) {
      return parts.slice(2).join('@');
    }
    return '0.0.0'; // fallback for malformed scoped packages
  }

  // Handle regular packages like react@18.0.0
  const atIndex = packageKey.lastIndexOf('@');
  if (atIndex > 0) {
    return packageKey.substring(atIndex + 1);
  }

  return '0.0.0'; // fallback
}

export function stringifyBunLockfile(
  graph: ProjectGraph,
  rootLockFileContent: string,
  packageJson: NormalizedPackageJson
): string {
  const existingLockfile = parseBunLockFile(rootLockFileContent, '');
  const workspacePackages = getWorkspacePackagesFromGraph(graph);

  // Create a new lockfile structure
  const newLockfile: BunLockFile = {
    lockfileVersion: existingLockfile.lockfileVersion || 1,
    packages: {},
  };

  // Copy workspace configuration if present
  if (existingLockfile.workspaces) {
    newLockfile.workspaces = existingLockfile.workspaces;
  }

  // Add all external nodes from the graph
  for (const node of Object.values(graph.externalNodes)) {
    if (node.type === 'npm') {
      const packageName = node.data.packageName;
      const version = node.data.version;
      const packageKey = `${packageName}@${version}`;

      // Find the original package data if it exists
      const originalPackageData = findOriginalPackageData(
        existingLockfile.packages || {},
        packageName,
        version
      );

      if (originalPackageData) {
        newLockfile.packages[packageKey] = originalPackageData;
      } else {
        // Create minimal package entry
        newLockfile.packages[packageKey] = {
          name: packageName,
          version: version,
          resolution: {
            type: 'npm',
            registry: 'https://registry.npmjs.org',
            specifier: `^${version}`,
          },
        };
      }
    }
  }

  // Add dependencies from package.json
  const depTypes = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ];
  for (const depType of depTypes) {
    if (packageJson[depType]) {
      for (const [depName, depVersion] of Object.entries(
        packageJson[depType]
      )) {
        // Skip workspace packages
        if (workspacePackages.has(depName)) {
          continue;
        }

        // Find the node in the graph
        const node = findNodeInGraph(graph, depName, depVersion as string);
        if (node) {
          const packageKey = `${depName}@${node.data.version}`;
          if (!newLockfile.packages[packageKey]) {
            const originalData = findOriginalPackageData(
              existingLockfile.packages || {},
              depName,
              node.data.version
            );

            if (originalData) {
              newLockfile.packages[packageKey] = originalData;
            }
          }
        }
      }
    }
  }

  // Sort packages for consistent output
  const sortedPackages: Record<string, BunDependency> = {};
  Object.keys(newLockfile.packages)
    .sort()
    .forEach((key) => {
      sortedPackages[key] = newLockfile.packages[key];
    });
  newLockfile.packages = sortedPackages;

  return JSON.stringify(newLockfile, null, 2);
}

function findOriginalPackageData(
  packages: Record<string, BunDependency>,
  packageName: string,
  version: string
): BunDependency | null {
  const exactKey = `${packageName}@${version}`;
  if (packages[exactKey]) {
    return packages[exactKey];
  }

  // Look for alternative keys
  for (const [key, data] of Object.entries(packages)) {
    if (
      (data.name === packageName && data.version === version) ||
      (getPackageNameFromKey(key) === packageName &&
        getVersionFromKey(key) === version)
    ) {
      return data;
    }
  }

  return null;
}

function findNodeInGraph(
  graph: ProjectGraph,
  packageName: string,
  versionSpec: string
): ProjectGraphExternalNode | null {
  // Try exact match first
  const exactNode = graph.externalNodes[`npm:${packageName}@${versionSpec}`];
  if (exactNode) {
    return exactNode;
  }

  // Try without version
  const nodeWithoutVersion = graph.externalNodes[`npm:${packageName}`];
  if (nodeWithoutVersion) {
    return nodeWithoutVersion;
  }

  // Look for any matching package name
  for (const node of Object.values(graph.externalNodes)) {
    if (node.data.packageName === packageName) {
      return node;
    }
  }

  return null;
}
