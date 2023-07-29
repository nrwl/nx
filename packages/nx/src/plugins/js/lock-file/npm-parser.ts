import { existsSync, readFileSync } from 'fs';
import { satisfies } from 'semver';
import { workspaceRoot } from '../../../utils/workspace-root';
import { reverse } from '../../../project-graph/operators';
import { NormalizedPackageJson } from './utils/package-json';
import { ProjectGraphBuilder } from '../../../project-graph/project-graph-builder';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../../../config/project-graph';
import { fileHasher, hashArray } from '../../../hasher/file-hasher';

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
  packages?: Record<string, NpmDependencyV3>;
  dependencies?: Record<string, NpmDependencyV1>;
};

export function parseNpmLockfile(
  lockFileContent: string,
  builder: ProjectGraphBuilder
) {
  const data = JSON.parse(lockFileContent) as NpmLockFile;

  // we use key => node map to avoid duplicate work when parsing keys
  const keyMap = new Map<string, ProjectGraphExternalNode>();
  addNodes(data, builder, keyMap);
  addDependencies(data, builder, keyMap);
}

function addNodes(
  data: NpmLockFile,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  const nodes: Map<string, Map<string, ProjectGraphExternalNode>> = new Map();

  if (data.lockfileVersion > 1) {
    Object.entries(data.packages).forEach(([path, snapshot]) => {
      // skip workspaces packages
      if (path === '' || !path.includes('node_modules') || snapshot.link) {
        return;
      }

      const packageName = path.split('node_modules/').pop();
      const version = findV3Version(snapshot, packageName);
      createNode(packageName, version, path, nodes, keyMap, snapshot);
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
                keyMap,
                builder
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
          keyMap,
          builder
        );
      }
    });
  }

  // some packages can be both hoisted and nested
  // so we need to run this check once we have all the nodes and paths
  for (const [packageName, versionMap] of nodes.entries()) {
    const hoistedNode = keyMap.get(`node_modules/${packageName}`);
    if (hoistedNode) {
      hoistedNode.name = `npm:${packageName}`;
    }

    versionMap.forEach((node) => {
      builder.addExternalNode(node);
    });
  }
}

function addV1Node(
  packageName: string,
  snapshot: NpmDependencyV1,
  path: string,
  nodes: Map<string, Map<string, ProjectGraphExternalNode>>,
  keyMap: Map<string, ProjectGraphExternalNode>,
  builder: ProjectGraphBuilder
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
        keyMap,
        builder
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

function addDependencies(
  data: NpmLockFile,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
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
            const target = findTarget(path, keyMap, name, versionRange);
            if (target) {
              builder.addStaticDependency(sourceName, target.name);
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
        builder,
        keyMap
      );
    });
  }
}

function findTarget(
  sourcePath: string,
  keyMap: Map<string, ProjectGraphExternalNode>,
  targetName: string,
  versionRange: string
): ProjectGraphExternalNode {
  if (sourcePath && !sourcePath.endsWith('/')) {
    sourcePath = `${sourcePath}/`;
  }
  const searchPath = `${sourcePath}node_modules/${targetName}`;

  if (keyMap.has(searchPath)) {
    const child = keyMap.get(searchPath);
    if (
      child.data.version === versionRange ||
      satisfies(child.data.version, versionRange)
    ) {
      return child;
    }
  }
  // the hoisted package did not match, this dependency is missing
  if (!sourcePath) {
    return;
  }
  return findTarget(
    sourcePath.split('node_modules/').slice(0, -1).join('node_modules/'),
    keyMap,
    targetName,
    versionRange
  );
}

function addV1NodeDependencies(
  path: string,
  snapshot: NpmDependencyV1,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  if (keyMap.has(path) && snapshot.requires) {
    const source = keyMap.get(path).name;
    Object.entries(snapshot.requires).forEach(([name, versionRange]) => {
      const target = findTarget(path, keyMap, name, versionRange);
      if (target) {
        builder.addStaticDependency(source, target.name);
      }
    });
  }

  if (snapshot.dependencies) {
    Object.entries(snapshot.dependencies).forEach(([depName, depSnapshot]) => {
      addV1NodeDependencies(
        `${path}/node_modules/${depName}`,
        depSnapshot,
        builder,
        keyMap
      );
    });
  }
  const { peerDependencies } = getPeerDependencies(path);
  if (peerDependencies) {
    const node = keyMap.get(path);
    Object.entries(peerDependencies).forEach(([depName, depSpec]) => {
      if (
        !builder.graph.dependencies[node.name]?.find(
          (d) => d.target === depName
        )
      ) {
        const target = findTarget(path, keyMap, depName, depSpec);
        if (target) {
          builder.addStaticDependency(node.name, target.name);
        }
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

  const mappedPackages = mapSnapshots(rootLockFile, graph);

  const output: NpmLockFile = {
    name: packageJson.name || rootLockFile.name,
    version: packageJson.version || '0.0.1',
    lockfileVersion: rootLockFile.lockfileVersion,
  };
  if (rootLockFile.requires) {
    output.requires = rootLockFile.requires;
  }
  if (lockfileVersion > 1) {
    output.packages = mapV3Snapshots(mappedPackages, packageJson);
  }
  if (lockfileVersion < 3) {
    output.dependencies = mapV1Snapshots(mappedPackages);
  }

  return JSON.stringify(output, null, 2);
}

function mapV3Snapshots(
  mappedPackages: MappedPackage[],
  packageJson: NormalizedPackageJson
): Record<string, NpmDependencyV3> {
  const output: Record<string, NpmDependencyV3> = {};
  output[''] = packageJson;

  mappedPackages.forEach((p) => {
    output[p.path] = p.valueV3;
  });

  return output;
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
  const visitedNodes = new Map<ProjectGraphExternalNode, Set<string>>();
  const visitedPaths = new Set<string>();

  const remappedPackages: Map<string, MappedPackage> = new Map();

  // add first level children
  Object.values(graph.externalNodes).forEach((node) => {
    if (node.name === `npm:${node.data.packageName}`) {
      const mappedPackage = mapPackage(
        rootLockFile,
        node.data.packageName,
        node.data.version
      );
      remappedPackages.set(mappedPackage.path, mappedPackage);
      visitedNodes.set(node, new Set([mappedPackage.path]));
      visitedPaths.add(mappedPackage.path);
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
      visitedPaths,
      rootLockFile
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
  packageName: string,
  version: string,
  parentPath = ''
): MappedPackage {
  const lockfileVersion = rootLockFile.lockfileVersion;

  let valueV3, valueV1;
  if (lockfileVersion < 3) {
    valueV1 = findMatchingPackageV1(
      rootLockFile.dependencies,
      packageName,
      version
    );
  }
  if (lockfileVersion > 1) {
    valueV3 = findMatchingPackageV3(
      rootLockFile.packages,
      packageName,
      version
    );
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
  visitedNodes: Map<ProjectGraphExternalNode, Set<string>>,
  visitedPaths: Set<string>,
  rootLockFile: NpmLockFile
) {
  const initialSize = nestedNodes.size;

  if (!initialSize) {
    return;
  }

  nestedNodes.forEach((node) => {
    let unresolvedParents = invertedGraph.dependencies[node.name].length;
    invertedGraph.dependencies[node.name].forEach(({ target }) => {
      const targetNode = invertedGraph.externalNodes[target];

      if (visitedNodes.has(targetNode)) {
        visitedNodes.get(targetNode).forEach((path) => {
          const mappedPackage = mapPackage(
            rootLockFile,
            node.data.packageName,
            node.data.version,
            path + '/'
          );
          result.set(mappedPackage.path, mappedPackage);
          if (visitedNodes.has(node)) {
            visitedNodes.get(node).add(mappedPackage.path);
          } else {
            visitedNodes.set(node, new Set([mappedPackage.path]));
          }
          visitedPaths.add(mappedPackage.path);
        });
        unresolvedParents--;
      }
    });
    if (!unresolvedParents) {
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
      visitedPaths,
      rootLockFile
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

    // we keep hoisted packages intact
    if (segments.length === 1) {
      result.set(path, mappedPackage);
      return;
    }

    const packageName = segments.pop();
    const getNewPath = (segs) =>
      `${segs.join('/node_modules/')}/node_modules/${packageName}`;

    // check if grandparent has the same package
    const shouldElevate = (segs: string[]) => {
      const elevatedPath = getNewPath(segs.slice(0, -1));
      if (result.has(elevatedPath)) {
        const match = result.get(elevatedPath);
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

function findMatchingPackageV3(
  packages: Record<string, NpmDependencyV3>,
  name: string,
  version: string
) {
  for (const [key, { dev, peer, ...snapshot }] of Object.entries(packages)) {
    if (key.endsWith(`node_modules/${name}`)) {
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
}

function findMatchingPackageV1(
  packages: Record<string, NpmDependencyV1>,
  name: string,
  version: string
) {
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
