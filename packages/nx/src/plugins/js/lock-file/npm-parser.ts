import { existsSync, readFileSync } from 'fs';
import { satisfies } from 'semver';
import { workspaceRoot } from '../../../utils/workspace-root';
import { reverse } from '../../../project-graph/operators';
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
import { getExternalNodes } from './project-graph-pruning';

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

type NpmDependencyV3 = NpmDependency & {
  inBundle?: boolean;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional: boolean }>;
  link?: boolean;
};

type NpmDependencyV1 = NpmDependency & {
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmDependencyV1>;
};

type NpmLockFile = {
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

function getV3Packages(data: NpmLockFile): Record<string, NpmDependencyV3> {
  if (!data.packages) {
    throw new Error(
      `The npm lockfile (version ${data.lockfileVersion}) has no "packages" section.`
    );
  }
  return data.packages;
}

function getV1Dependencies(data: NpmLockFile): Record<string, NpmDependencyV1> {
  if (!data.dependencies) {
    throw new Error(
      `The npm lockfile (version ${data.lockfileVersion}) has no "dependencies" section.`
    );
  }
  return data.dependencies;
}

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
  installedLocalPathNodes: Record<string, Record<string, string>>;
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
  installedLocalPathNodes: Record<string, Record<string, string>>;
} {
  const keyMap = new Map<string, ProjectGraphExternalNode>();
  const nodes: Map<string, Map<string, ProjectGraphExternalNode>> = new Map();
  const localPathPackageNames = new Set<string>();

  if (data.lockfileVersion > 1) {
    Object.entries(getV3Packages(data)).forEach(([path, snapshot]) => {
      // skip workspaces and snapshots bundled into their parent package
      if (
        path === '' ||
        !path.includes('node_modules') ||
        snapshot.link ||
        snapshot.inBundle
      ) {
        return;
      }

      const segments = path.split('node_modules/');
      const packageName = segments[segments.length - 1];
      const version = findV3Version(snapshot, packageName);
      // symlinked packages in workspaces do not have versions
      if (version) {
        createNode(packageName, version, path, nodes, keyMap, snapshot);
        if (snapshot.resolved?.startsWith('file:')) {
          localPathPackageNames.add(packageName);
        }
      }
    });
  } else {
    Object.entries(getV1Dependencies(data)).forEach(
      ([packageName, snapshot]) => {
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
      }
    );
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

  return {
    nodes: results,
    keyMap,
    installedLocalPathNodes: localPathPackageNames.size
      ? getInstalledLocalPathNodes(data, keyMap, localPathPackageNames)
      : {},
  };
}

function getInstalledLocalPathNodes(
  data: NpmLockFile,
  keyMap: Map<string, ProjectGraphExternalNode>,
  localPathPackageNames: Set<string>
): Record<string, Record<string, string>> {
  const installed: Record<string, Record<string, string>> = Object.create(null);
  const { packages } = data;
  if (!packages) {
    return installed;
  }
  for (const importerPath in packages) {
    if (importerPath !== '' && importerPath.includes('node_modules')) {
      continue;
    }
    const importer = packages[importerPath];
    for (const deps of [
      importer.dependencies,
      importer.devDependencies,
      importer.optionalDependencies,
      importer.peerDependencies,
    ]) {
      for (const depName of Object.keys(deps ?? {})) {
        if (!localPathPackageNames.has(depName)) {
          continue;
        }
        // Node loads the nearest copy, so a registry copy there wins
        const key = findNearestNpmPackageKey(packages, importerPath, depName);
        const snapshot = key && packages[key];
        if (
          !snapshot ||
          snapshot.link ||
          !snapshot.resolved?.startsWith('file:') ||
          (snapshot.name && snapshot.name !== depName)
        ) {
          continue;
        }
        const node = keyMap.get(key);
        if (node) {
          (installed[importerPath || '.'] ??= Object.create(null))[depName] =
            node.name;
        }
      }
    }
  }
  return installed;
}

function findNearestNpmPackageKey(
  packages: Record<string, NpmDependencyV3>,
  importerPath: string,
  packageName: string
): string | undefined {
  let dir = importerPath;
  while (true) {
    const key = `${dir ? `${dir}/` : ''}node_modules/${packageName}`;
    if (packages[key]) {
      return key;
    }
    if (!dir) {
      return undefined;
    }
    const slash = dir.lastIndexOf('/');
    dir = slash === -1 ? '' : dir.slice(0, slash);
  }
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
  const versionNodes = nodes.get(packageName);
  if (!versionNodes) {
    nodes.set(packageName, new Map([[version, node]]));
  } else {
    versionNodes.set(version, node);
  }
}

function findV3Version(
  snapshot: NpmDependencyV3,
  packageName: string
): string | undefined {
  let version: string | undefined = snapshot.version;

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
    Object.entries(getV3Packages(data)).forEach(([path, snapshot]) => {
      // we are skipping workspaces packages
      const sourceNode = keyMap.get(path);
      if (!sourceNode) {
        return;
      }
      const sourceName = sourceNode.name;
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
    Object.entries(getV1Dependencies(data)).forEach(
      ([packageName, snapshot]) => {
        addV1NodeDependencies(
          `node_modules/${packageName}`,
          snapshot,
          dependencies,
          keyMap,
          ctx,
          cachedSatisfies
        );
      }
    );
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
): ProjectGraphExternalNode | undefined {
  if (sourcePath && !sourcePath.endsWith('/')) {
    sourcePath = `${sourcePath}/`;
  }
  const searchPath = `${sourcePath}node_modules/${targetName}`;

  const child = keyMap.get(searchPath);
  if (child) {
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
      // A `file:` copy named by its path matches no range. Node loads the
      // nearest copy, so it wins unless a nearer copy is already the fallback.
      (!fallback && child.data.version.startsWith('file:')) ||
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
  // `node_modules/<pkg>` segment. Slash-index arithmetic avoids the
  // split/slice/join array allocation on every hop.
  const lastNodeModules = sourcePath.lastIndexOf('node_modules/');
  return findTarget(
    lastNodeModules === -1 ? '' : sourcePath.substring(0, lastNodeModules),
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
  const sourceNode = keyMap.get(path);
  if (sourceNode && snapshot.requires) {
    const source = sourceNode.name;
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
        if (!node) {
          throw new Error(`Could not find external node for "${path}".`);
        }
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

  const mappedPackages = mapSnapshots(rootLockFile, graph);
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
    output.packages = { ...packages, ...workspaceModules };
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
  const queue: string[] = Object.keys(packageJson.dependencies ?? {});
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
    if (p.valueV3) {
      output[p.path] = p.valueV3;
    }
  });

  return output;
}

function mapPackageJsonWithWorkspaceModules(
  packageJson: NormalizedPackageJson
) {
  const { dependencies } = packageJson;
  if (dependencies) {
    for (const [pkgName, pkgVersion] of Object.entries(dependencies)) {
      if (
        pkgVersion.startsWith('workspace:') ||
        pkgVersion.startsWith('file:')
      ) {
        dependencies[pkgName] = `workspace_modules/${pkgName}`;
      }
    }
  }
  return packageJson;
}

function mapV1Snapshots(
  mappedPackages: MappedPackage[]
): Record<string, NpmDependencyV1> {
  const output: Record<string, NpmDependencyV1> = {};

  mappedPackages.forEach((p) => {
    const parent = getPackageParent(p.path, output);
    if (p.valueV1) {
      parent[p.name] = p.valueV1;
    }
  });

  return output;
}

function getPackageParent(
  path: string,
  packages: Record<string, NpmDependencyV1>
): Record<string, NpmDependencyV1> {
  const [first, ...rest] = path.split(/\/?node_modules\//).slice(1, -1);

  if (first === undefined) {
    return packages;
  }

  let parent = packages[first];
  parent.dependencies ??= {};
  for (const segment of rest) {
    parent = parent.dependencies[segment];
    parent.dependencies ??= {};
  }
  return parent.dependencies;
}

type MappedPackage = {
  path: string;
  name: string;
  valueV3?: NpmDependencyV3;
  valueV1?: NpmDependencyV1;
};

function mapSnapshots(
  rootLockFile: NpmLockFile,
  graph: ProjectGraph
): MappedPackage[] {
  const nestedNodes = new Set<ProjectGraphExternalNode>();
  const visitedNodes = new Map<
    ProjectGraphExternalNode,
    {
      packagePaths: Set<string>;
      unresolvedParents: Set<string>;
    }
  >();
  const remappedPackages: Map<string, MappedPackage> = new Map();
  const packageIndex = buildV3Index(rootLockFile.packages);

  // add first level children
  Object.values(getExternalNodes(graph)).forEach((node) => {
    if (node.name === `npm:${node.data.packageName}`) {
      const mappedPackage = mapPackage(
        rootLockFile,
        packageIndex,
        node.data.packageName,
        node.data.version
      );
      remappedPackages.set(mappedPackage.path, mappedPackage);
      visitedNodes.set(node, {
        packagePaths: new Set([mappedPackage.path]),
        unresolvedParents: new Set(),
      });
    } else {
      nestedNodes.add(node);
    }
  });

  let remappedPackagesArray: MappedPackage[];
  if (nestedNodes.size) {
    const invertedGraph = reverse(graph);
    nestMappedPackages(
      invertedGraph,
      remappedPackages,
      nestedNodes,
      visitedNodes,
      rootLockFile,
      packageIndex
    );
    // initially we naively map package paths to topParent/../parent/child
    // but some of those should be nested higher up the tree
    remappedPackagesArray = elevateNestedPaths(remappedPackages);
  } else {
    remappedPackagesArray = Array.from(remappedPackages.values());
  }
  return remappedPackagesArray.sort((a, b) => a.path.localeCompare(b.path));
}

function mapPackage(
  rootLockFile: NpmLockFile,
  packageIndex: V3Index,
  packageName: string,
  version: string,
  parentPath = ''
): MappedPackage {
  const lockfileVersion = rootLockFile.lockfileVersion;

  let valueV3: NpmDependencyV3 | undefined;
  let valueV1: NpmDependencyV1 | undefined;
  if (lockfileVersion < 3) {
    valueV1 = findMatchingPackageV1(
      getV1Dependencies(rootLockFile),
      packageName,
      version
    );
  }
  if (lockfileVersion > 1) {
    valueV3 = findMatchingPackageV3(packageIndex, packageName, version);
  }

  return {
    path: parentPath + `node_modules/${packageName}`,
    name: packageName,
    valueV1,
    valueV3,
  };
}

function nestMappedPackages(
  invertedGraph: ProjectGraph,
  result: Map<string, MappedPackage>,
  nestedNodes: Set<ProjectGraphExternalNode>,
  visitedNodes: Map<
    ProjectGraphExternalNode,
    {
      packagePaths: Set<string>;
      unresolvedParents: Set<string>;
    }
  >,
  rootLockFile: NpmLockFile,
  packageIndex: V3Index
) {
  const initialSize = nestedNodes.size;

  if (!initialSize) {
    return;
  }

  nestedNodes.forEach((node) => {
    let nodeVisit = visitedNodes.get(node);
    if (!nodeVisit) {
      nodeVisit = {
        packagePaths: new Set(),
        unresolvedParents: new Set(
          invertedGraph.dependencies[node.name].map(({ target }) => target)
        ),
      };
      visitedNodes.set(node, nodeVisit);
    }

    invertedGraph.dependencies[node.name].forEach(({ target }) => {
      if (!nodeVisit.unresolvedParents.has(target)) {
        return;
      }

      const targetNode = getExternalNodes(invertedGraph)[target];
      const targetVisit = visitedNodes.get(targetNode);
      if (targetVisit && !targetVisit.unresolvedParents.size) {
        targetVisit.packagePaths.forEach((path) => {
          const mappedPackage = mapPackage(
            rootLockFile,
            packageIndex,
            node.data.packageName,
            node.data.version,
            path + '/'
          );
          result.set(mappedPackage.path, mappedPackage);
          nodeVisit.packagePaths.add(mappedPackage.path);
          nodeVisit.unresolvedParents.delete(target);
        });
      }
    });
    if (!nodeVisit.unresolvedParents.size) {
      nestedNodes.delete(node);
    }
  });

  if (initialSize === nestedNodes.size) {
    throw new Error(
      [
        'Following packages could not be mapped to the NPM lockfile:',
        ...Array.from(nestedNodes).map((n) => `- ${n.name}`),
      ].join('\n')
    );
  } else {
    nestMappedPackages(
      invertedGraph,
      result,
      nestedNodes,
      visitedNodes,
      rootLockFile,
      packageIndex
    );
  }
}

// sort paths by number of segments and then alphabetically
function sortMappedPackagesPaths(mappedPackages: Map<string, MappedPackage>) {
  return Array.from(mappedPackages.keys()).sort((a, b) => {
    const aLength = a.split('/node_modules/').length;
    const bLength = b.split('/node_modules/').length;
    if (aLength > bLength) {
      return 1;
    }
    if (aLength < bLength) {
      return -1;
    }
    return a.localeCompare(b);
  });
}

function elevateNestedPaths(
  remappedPackages: Map<string, MappedPackage>
): MappedPackage[] {
  const result = new Map<string, MappedPackage>();
  const sortedPaths = sortMappedPackagesPaths(remappedPackages);

  sortedPaths.forEach((path) => {
    const segments = path.split('/node_modules/');
    const mappedPackage = remappedPackages.get(path);
    if (!mappedPackage) {
      return;
    }

    // we keep hoisted packages intact
    if (segments.length === 1) {
      result.set(path, mappedPackage);
      return;
    }

    const packageName = segments.pop();
    const getNewPath = (segs: string[]) =>
      `${segs.join('/node_modules/')}/node_modules/${packageName}`;

    // check if grandparent has the same package
    const shouldElevate = (segs: string[]) => {
      const elevatedPath = getNewPath(segs.slice(0, -1));
      const match = result.get(elevatedPath);
      if (match) {
        return (
          match.valueV1?.version === mappedPackage.valueV1?.version &&
          match.valueV3?.version === mappedPackage.valueV3?.version
        );
      }
      return true;
    };

    while (segments.length > 1 && shouldElevate(segments)) {
      segments.pop();
    }
    const newPath = getNewPath(segments);
    if (path !== newPath) {
      if (!result.has(newPath)) {
        mappedPackage.path = newPath;
        result.set(newPath, mappedPackage);
      }
    } else {
      result.set(path, mappedPackage);
    }
  });

  return Array.from(result.values());
}

type V3Index = Map<string, NpmDependencyV3[]>;

// Bucket packages by their trailing "node_modules/<name>" segment so a lookup
// scans only that name's copies instead of every package (was O(nodes *
// allPackages)). Mirrors the old `key.endsWith(node_modules/<name>)` match:
// the name is whatever follows the last "node_modules/" in the key.
function buildV3Index(
  packages: Record<string, NpmDependencyV3> | undefined
): V3Index {
  const index: V3Index = new Map();
  if (!packages) return index;
  const marker = 'node_modules/';
  for (const key of Object.keys(packages)) {
    const snapshot = packages[key];
    // Bundled snapshots are not independently installable package candidates.
    if (snapshot.inBundle) continue;
    const i = key.lastIndexOf(marker);
    if (i === -1) continue; // root "" / workspace paths never matched endsWith
    const name = key.slice(i + marker.length);
    let bucket = index.get(name);
    if (!bucket) index.set(name, (bucket = []));
    bucket.push(snapshot);
  }
  return index;
}

function findMatchingPackageV3(
  packageIndex: V3Index,
  name: string,
  version: string
) {
  const bucket = packageIndex.get(name);
  if (!bucket) return undefined;
  for (const { dev, peer, ...snapshot } of bucket) {
    if (
      [
        snapshot.version,
        snapshot.resolved,
        `npm:${snapshot.name}@${snapshot.version}`,
      ].includes(version)
    ) {
      return snapshot;
    }
  }
}

function findMatchingPackageV1(
  packages: Record<string, NpmDependencyV1>,
  name: string,
  version: string
): NpmDependency | undefined {
  for (const [
    packageName,
    { dev, peer, dependencies, ...snapshot },
  ] of Object.entries(packages)) {
    if (packageName === name) {
      if (snapshot.version === version) {
        return snapshot;
      }
    }
    if (dependencies) {
      const found = findMatchingPackageV1(dependencies, name, version);
      if (found) {
        return found;
      }
    }
  }
}

// NPM V1 does not track the peer dependencies in the lock file
// so we need to parse them directly from the package.json
function getPeerDependencies(path: string): {
  peerDependencies?: Record<string, string>;
} {
  const fullPath = `${workspaceRoot}/${path}/package.json`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    const { peerDependencies } = JSON.parse(content);
    return {
      ...(peerDependencies && { peerDependencies }),
    };
  } else {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.warn(`Could not find package.json at "${path}"`);
    }
    return {};
  }
}
