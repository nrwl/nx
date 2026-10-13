import { existsSync, readFileSync } from 'fs';
import { satisfies } from 'semver';
import { workspaceRoot } from '../../../utils/workspace-root';
import { NormalizedPackageJson } from './utils/package-json';
import {
  RawProjectGraphDependency,
  validateDependency,
} from '../../../project-graph/project-graph-builder';
import {
  DependencyType,
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import { hashArray } from '../../../hasher/file-hasher';
import { CreateDependenciesContext } from '../../../project-graph/plugins';
import { getWorkspacePackagesFromGraph } from '../utils/get-workspace-packages-from-graph';
import { mapSnapshots, type MappedPackage } from './utils/npm-placement';
import { setNpmDependencyFlags } from './utils/npm-dep-flags';

/**
 * NPM
 * - v1 has only dependencies
 * - v2 has packages and dependencies for backwards compatibility
 * - v3 has only packages
 */
type NpmDependency = {
  name?: string;
  version: string;
  resolved?: string;
  integrity?: string;
  dev?: boolean;
  peer?: boolean;
  devOptional?: boolean;
  optional?: boolean;
};

export type NpmDependencyV3 = NpmDependency & {
  inBundle?: boolean;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
  link?: boolean;
};

export type NpmDependencyV1 = NpmDependency & {
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmDependencyV1>;
};

export type NpmLockFile = {
  name?: string;
  version?: string;
  lockfileVersion: number;
  requires?: boolean;
  overrides?: NormalizedPackageJson['overrides'];
  packages?: Record<string, NpmDependencyV3>;
  dependencies?: Record<string, NpmDependencyV1>;
};
let currentLockFileHash: string;

let parsedLockFile: NpmLockFile;

function parsePackageLockFile(lockFileContent: string, lockFileHash: string) {
  if (lockFileHash === currentLockFileHash) {
    return parsedLockFile;
  }

  const results = JSON.parse(lockFileContent) as NpmLockFile;
  parsedLockFile = results;
  currentLockFileHash = lockFileHash;
  return results;
}

export function getNpmLockfileNodes(
  lockFileContent: string,
  lockFileHash: string
): {
  nodes: Record<string, ProjectGraphExternalNode>;
  keyMap: Map<string, ProjectGraphExternalNode>;
} {
  const data = parsePackageLockFile(
    lockFileContent,
    lockFileHash
  ) as NpmLockFile;

  return getNodes(data);
}

export function getNpmLockfileDependencies(
  lockFileContent: string,
  lockFileHash: string,
  ctx: CreateDependenciesContext,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  const data = parsePackageLockFile(
    lockFileContent,
    lockFileHash
  ) as NpmLockFile;

  return getDependencies(data, keyMap, ctx);
}

function getNodes(data: NpmLockFile): {
  nodes: Record<string, ProjectGraphExternalNode>;
  keyMap: Map<string, ProjectGraphExternalNode>;
} {
  const keyMap = new Map<string, ProjectGraphExternalNode>();
  const nodes: Map<string, Map<string, ProjectGraphExternalNode>> = new Map();

  if (data.lockfileVersion > 1) {
    Object.entries(data.packages).forEach(([path, snapshot]) => {
      // skip workspaces and snapshots bundled into their parent package
      if (
        path === '' ||
        !path.includes('node_modules') ||
        snapshot.link ||
        snapshot.inBundle
      ) {
        return;
      }

      const packageName = path.split('node_modules/').pop();
      const version = findV3Version(snapshot, packageName);
      // symlinked packages in workspaces do not have versions
      if (version) {
        createNode(packageName, version, path, nodes, keyMap, snapshot);
      }
    });
  } else {
    Object.entries(data.dependencies).forEach(([packageName, snapshot]) => {
      // we only care about dependencies of workspace packages
      if (snapshot.version?.startsWith('file:')) {
        if (snapshot.dependencies) {
          Object.entries(snapshot.dependencies).forEach(
            ([depName, depSnapshot]) => {
              addV1Node(
                depName,
                depSnapshot,
                `${snapshot.version.slice(5)}/node_modules/${depName}`,
                nodes,
                keyMap
              );
            }
          );
        }
      } else {
        addV1Node(
          packageName,
          snapshot,
          `node_modules/${packageName}`,
          nodes,
          keyMap
        );
      }
    });
  }

  const results: Record<string, ProjectGraphExternalNode> = {};

  // some packages can be both hoisted and nested
  // so we need to run this check once we have all the nodes and paths
  for (const [packageName, versionMap] of nodes.entries()) {
    const hoistedNode = keyMap.get(`node_modules/${packageName}`);
    if (hoistedNode) {
      hoistedNode.name = `npm:${packageName}`;
    }

    versionMap.forEach((node) => {
      results[node.name] = node;
    });
  }
  return { nodes: results, keyMap };
}

function addV1Node(
  packageName: string,
  snapshot: NpmDependencyV1,
  path: string,
  nodes: Map<string, Map<string, ProjectGraphExternalNode>>,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  createNode(packageName, snapshot.version, path, nodes, keyMap, snapshot);

  // traverse nested dependencies
  if (snapshot.dependencies) {
    Object.entries(snapshot.dependencies).forEach(([depName, depSnapshot]) => {
      addV1Node(
        depName,
        depSnapshot,
        `${path}/node_modules/${depName}`,
        nodes,
        keyMap
      );
    });
  }
}

function createNode(
  packageName: string,
  version: string,
  key: string,
  nodes: Map<string, Map<string, ProjectGraphExternalNode>>,
  keyMap: Map<string, ProjectGraphExternalNode>,
  snapshot: NpmDependencyV3 | NpmDependencyV1
) {
  const existingNode = nodes.get(packageName)?.get(version);
  if (existingNode) {
    keyMap.set(key, existingNode);
    return;
  }

  const node: ProjectGraphExternalNode = {
    type: 'npm',
    name: version ? `npm:${packageName}@${version}` : `npm:${packageName}`,
    data: {
      version,
      packageName,
      hash:
        snapshot.integrity ||
        hashArray(
          snapshot.resolved
            ? [snapshot.resolved]
            : version
              ? [packageName, version]
              : [packageName]
        ),
    },
  };

  keyMap.set(key, node);
  if (!nodes.has(packageName)) {
    nodes.set(packageName, new Map([[version, node]]));
  } else {
    nodes.get(packageName).set(version, node);
  }
}

function findV3Version(snapshot: NpmDependencyV3, packageName: string): string {
  let version = snapshot.version;

  const resolved = snapshot.resolved;
  // for tarball packages version might not exist or be useless
  if (!version || (resolved && !resolved.includes(version))) {
    version = resolved;
  }
  // for alias packages name is set
  if (snapshot.name && snapshot.name !== packageName) {
    if (version) {
      version = `npm:${snapshot.name}@${version}`;
    } else {
      version = `npm:${snapshot.name}`;
    }
  }

  return version;
}

function getDependencies(
  data: NpmLockFile,
  keyMap: Map<string, ProjectGraphExternalNode>,
  ctx: CreateDependenciesContext
): RawProjectGraphDependency[] {
  const dependencies: RawProjectGraphDependency[] = [];
  // Memoizes semver `satisfies(version, range)` for this dependency walk. The
  // same (version, range) pairs recur across many edges, so the range parse
  // happens once per distinct pair instead of once per edge. Scoped to the walk
  // (not module-global) so V8 collects it when dependency creation finishes
  // rather than retaining it for the daemon's lifetime.
  const versionSatisfiesCache = new Map<string, boolean>();
  const cachedSatisfies = (version: string, range: string): boolean => {
    const key = `${version}\n${range}`;
    const cached = versionSatisfiesCache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const result = satisfies(version, range);
    versionSatisfiesCache.set(key, result);
    return result;
  };
  if (data.lockfileVersion > 1) {
    Object.entries(data.packages).forEach(([path, snapshot]) => {
      // we are skipping workspaces packages
      if (!keyMap.has(path)) {
        return;
      }
      const sourceName = keyMap.get(path).name;
      [
        snapshot.peerDependencies,
        snapshot.dependencies,
        snapshot.optionalDependencies,
      ].forEach((section) => {
        if (section) {
          Object.entries(section).forEach(([name, versionRange]) => {
            const target = findTarget(
              path,
              keyMap,
              name,
              versionRange,
              cachedSatisfies
            );
            if (target) {
              const dep: RawProjectGraphDependency = {
                source: sourceName,
                target: target.name,
                type: DependencyType.static,
              };
              validateDependency(dep, ctx);
              dependencies.push(dep);
            }
          });
        }
      });
    });
  } else {
    Object.entries(data.dependencies).forEach(([packageName, snapshot]) => {
      addV1NodeDependencies(
        `node_modules/${packageName}`,
        snapshot,
        dependencies,
        keyMap,
        ctx,
        cachedSatisfies
      );
    });
  }
  return dependencies;
}

function findTarget(
  sourcePath: string,
  keyMap: Map<string, ProjectGraphExternalNode>,
  targetName: string,
  versionRange: string,
  cachedSatisfies: (version: string, range: string) => boolean,
  // When a package is found at a path but its version doesn't satisfy the
  // range (e.g. due to npm overrides), we keep it as a fallback. npm already
  // resolved this dependency to that location, so it is the correct target
  // even though the semver check fails.
  fallback?: ProjectGraphExternalNode
): ProjectGraphExternalNode {
  if (sourcePath && !sourcePath.endsWith('/')) {
    sourcePath = `${sourcePath}/`;
  }
  const searchPath = `${sourcePath}node_modules/${targetName}`;

  if (keyMap.has(searchPath)) {
    const child = keyMap.get(searchPath);
    // if the version is alias to another package we need to parse the versions to compare
    if (
      child.data.version.startsWith('npm:') &&
      versionRange.startsWith('npm:')
    ) {
      const nodeVersion = child.data.version.slice(
        child.data.version.indexOf('@', 5) + 1
      );
      const depVersion = versionRange.slice(versionRange.indexOf('@', 5) + 1);
      if (
        nodeVersion === depVersion ||
        cachedSatisfies(nodeVersion, depVersion)
      ) {
        return child;
      }
    } else if (
      child.data.version === versionRange ||
      cachedSatisfies(child.data.version, versionRange)
    ) {
      return child;
    }
    // Version mismatch — save as fallback (could be an npm override)
    if (!fallback) {
      fallback = child;
    }
  }
  // the hoisted package did not match, this dependency is missing
  if (!sourcePath) {
    return fallback;
  }
  // Walk one level up the nesting chain by dropping the trailing
  // `node_modules/<pkg>` segment, or from a workspace directory to its parent,
  // as Node does. Slash-index arithmetic avoids an array allocation per hop.
  const lastNodeModules = sourcePath.lastIndexOf('node_modules/');
  return findTarget(
    lastNodeModules === -1
      ? sourcePath.substring(
          0,
          sourcePath.lastIndexOf('/', sourcePath.length - 2) + 1
        )
      : sourcePath.substring(0, lastNodeModules),
    keyMap,
    targetName,
    versionRange,
    cachedSatisfies,
    fallback
  );
}

function addV1NodeDependencies(
  path: string,
  snapshot: NpmDependencyV1,
  dependencies: RawProjectGraphDependency[],
  keyMap: Map<string, ProjectGraphExternalNode>,
  ctx: CreateDependenciesContext,
  cachedSatisfies: (version: string, range: string) => boolean
) {
  if (keyMap.has(path) && snapshot.requires) {
    const source = keyMap.get(path).name;
    Object.entries(snapshot.requires).forEach(([name, versionRange]) => {
      const target = findTarget(
        path,
        keyMap,
        name,
        versionRange,
        cachedSatisfies
      );
      if (target) {
        const dep: RawProjectGraphDependency = {
          source: source,
          target: target.name,
          type: DependencyType.static,
        };
        validateDependency(dep, ctx);
        dependencies.push(dep);
      }
    });
  }

  if (snapshot.dependencies) {
    Object.entries(snapshot.dependencies).forEach(([depName, depSnapshot]) => {
      addV1NodeDependencies(
        `${path}/node_modules/${depName}`,
        depSnapshot,
        dependencies,
        keyMap,
        ctx,
        cachedSatisfies
      );
    });
  }
  const { peerDependencies } = getPeerDependencies(path);
  if (peerDependencies) {
    const node = keyMap.get(path);
    Object.entries(peerDependencies).forEach(([depName, depSpec]) => {
      const target = findTarget(
        path,
        keyMap,
        depName,
        depSpec,
        cachedSatisfies
      );
      if (target) {
        const dep: RawProjectGraphDependency = {
          source: node.name,
          target: target.name,
          type: DependencyType.static,
        };
        validateDependency(dep, ctx);
        dependencies.push(dep);
      }
    });
  }
}

export function stringifyNpmLockfile(
  graph: ProjectGraph,
  rootLockFileContent: string,
  packageJson: NormalizedPackageJson
): string {
  const rootLockFile = JSON.parse(rootLockFileContent) as NpmLockFile;
  const { lockfileVersion } = JSON.parse(rootLockFileContent) as NpmLockFile;
  const workspaceModulesFromGraph = getWorkspacePackagesFromGraph(graph);

  const mappedPackages = mapSnapshots(rootLockFile, graph, packageJson);
  const workspaceModules = mapWorkspaceModules(
    packageJson,
    rootLockFile,
    workspaceModulesFromGraph
  );

  const output: NpmLockFile = {
    name: packageJson.name || rootLockFile.name,
    version: packageJson.version || '0.0.1',
    lockfileVersion: rootLockFile.lockfileVersion,
  };
  if (rootLockFile.requires) {
    output.requires = rootLockFile.requires;
  }
  if (packageJson.overrides && Object.keys(packageJson.overrides).length > 0) {
    output.overrides = packageJson.overrides;
  }
  if (lockfileVersion > 1) {
    const packages = mapV3Snapshots(mappedPackages, packageJson);
    output.packages = setNpmDependencyFlags({
      ...packages,
      ...workspaceModules,
    });
  }
  if (lockfileVersion < 3) {
    const dependencies = mapV1Snapshots(mappedPackages);
    output.dependencies = { ...dependencies, ...workspaceModules };
  }

  return JSON.stringify(output, null, 2);
}

const WORKSPACE_DEP_TYPES = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
] as const;

// The pruned package's sections copy-workspace-modules copies a module from.
const ROOT_WORKSPACE_DEP_TYPES = [
  ...WORKSPACE_DEP_TYPES,
  'devDependencies',
] as const;

function mapWorkspaceModules(
  packageJson: NormalizedPackageJson,
  rootLockFile: NpmLockFile,
  workspaceModules: Map<string, ProjectGraphProjectNode>
) {
  const output: Record<string, NpmDependencyV3 & NpmDependencyV1> = {};
  const snapshotsByName = new Map<string, NpmDependencyV3 & NpmDependencyV1>();
  for (const snapshot of Object.values(
    rootLockFile.packages || rootLockFile.dependencies || {}
  )) {
    if (snapshot.name) snapshotsByName.set(snapshot.name, snapshot);
  }

  // Walk transitive workspace deps so every workspace package
  // copy-workspace-modules writes to disk has matching lockfile entries.
  // Without this, `npm ci` errors with "Missing: <pkg> from lock file".
  const queue: string[] = ROOT_WORKSPACE_DEP_TYPES.flatMap((depType) =>
    Object.keys(packageJson[depType] ?? {})
  );
  const visited = new Set<string>();
  while (queue.length > 0) {
    const pkgName = queue.shift()!;
    if (visited.has(pkgName) || !workspaceModules.has(pkgName)) continue;
    visited.add(pkgName);

    const snapshot = snapshotsByName.get(pkgName);

    output[`node_modules/${pkgName}`] = {
      version: `file:./workspace_modules/${pkgName}`,
      resolved: `workspace_modules/${pkgName}`,
      link: true,
    };
    output[`workspace_modules/${pkgName}`] = {
      name: pkgName,
      version: `0.0.1`,
      dependencies: snapshot?.dependencies,
      optionalDependencies: snapshot?.optionalDependencies,
      peerDependencies: snapshot?.peerDependencies,
      peerDependenciesMeta: snapshot?.peerDependenciesMeta,
    };

    for (const depType of WORKSPACE_DEP_TYPES) {
      const deps = snapshot?.[depType];
      if (!deps) continue;
      for (const depName of Object.keys(deps)) queue.push(depName);
    }
  }
  return output;
}

function mapV3Snapshots(
  mappedPackages: MappedPackage[],
  packageJson: NormalizedPackageJson
): Record<string, NpmDependencyV3> {
  const output: Record<string, NpmDependencyV3> = {};
  const mappedPackageJson = mapPackageJsonWithWorkspaceModules(packageJson);
  output[''] = mappedPackageJson;

  mappedPackages.forEach((p) => {
    output[p.path] = p.valueV3;
  });

  return output;
}

function mapPackageJsonWithWorkspaceModules(
  packageJson: NormalizedPackageJson
) {
  for (const [pkgName, pkgVersion] of Object.entries(
    packageJson.dependencies ?? {}
  )) {
    if (pkgVersion.startsWith('workspace:') || pkgVersion.startsWith('file:')) {
      packageJson.dependencies[pkgName] = `workspace_modules/${pkgName}`;
    }
  }
  return packageJson;
}

function mapV1Snapshots(
  mappedPackages: MappedPackage[]
): Record<string, NpmDependencyV1> {
  const output: Record<string, NpmDependencyV1> = {};

  mappedPackages.forEach((p) => {
    getPackageParent(p.path, output)[p.name] = p.valueV1;
  });

  return output;
}

function getPackageParent(
  path: string,
  packages: Record<string, NpmDependencyV1>
): Record<string, NpmDependencyV1> {
  const segments = path.split(/\/?node_modules\//).slice(1, -1);

  if (!segments.length) {
    return packages;
  }

  let parent = packages[segments.shift()];
  if (!parent.dependencies) {
    parent.dependencies = {};
  }
  while (segments.length) {
    parent = parent.dependencies[segments.shift()];
    if (!parent.dependencies) {
      parent.dependencies = {};
    }
  }
  return parent.dependencies;
}

// NPM V1 does not track the peer dependencies in the lock file
// so we need to parse them directly from the package.json
function getPeerDependencies(path: string): {
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
} {
  const fullPath = `${workspaceRoot}/${path}/package.json`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    const { peerDependencies, peerDependenciesMeta } = JSON.parse(content);
    return {
      ...(peerDependencies && { peerDependencies }),
      ...(peerDependenciesMeta && { peerDependenciesMeta }),
    };
  } else {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.warn(`Could not find package.json at "${path}"`);
    }
    return {};
  }
}
