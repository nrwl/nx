import { existsSync, readFileSync } from 'fs-extra';
import { satisfies } from 'semver';
import { workspaceRoot } from '../utils/workspace-root';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import { reverse } from '../project-graph/operators';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../config/project-graph';
import { NpmDependencyV1, NpmDependencyV3, NpmLockFile } from './utils/types';
import { NormalizedPackageJson } from './utils/types';

export function parseNpmLockfile(lockFileContent: string): ProjectGraph {
  const data = JSON.parse(lockFileContent) as NpmLockFile;

  const builder = new ProjectGraphBuilder();
  const keyMap = new Map<string, ProjectGraphExternalNode>();
  addNodes(data, builder, keyMap);
  addDependencies(data, builder, keyMap);

  return builder.getUpdatedProjectGraph();
}

function addNodes(
  data: NpmLockFile,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  const addedNodes: Map<
    string,
    Map<string, ProjectGraphExternalNode>
  > = new Map();

  if (data.lockfileVersion > 1) {
    Object.entries(data.packages).forEach(([path, snapshot]) => {
      // skip workspaces packages
      if (path === '' || !path.includes('node_modules') || snapshot.link) {
        return;
      }

      const packageName = path.split('node_modules/').pop();
      const version = findV3Version(snapshot, packageName);
      const node = createNode(packageName, version, path, addedNodes, keyMap);
      // if node was already added the createNode will return undefined
      if (node) {
        builder.addExternalNode(node);
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
                addedNodes,
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
          addedNodes,
          keyMap,
          builder
        );
      }
    });
  }
}

function createNode(
  packageName: string,
  version: string,
  path: string,
  addedNodes: Map<string, Map<string, ProjectGraphExternalNode>>,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  // we don't need to keep duplicates, we can just track the keys
  const existingNode = addedNodes.get(packageName)?.get(version);
  if (existingNode) {
    keyMap.set(path, existingNode);
    return;
  }

  const isHoisted = !path.includes('/node_modules/');
  const node: ProjectGraphExternalNode = {
    type: 'npm',
    name: isHoisted ? `npm:${packageName}` : `npm:${packageName}@${version}`,
    data: {
      version,
      packageName,
    },
  };

  if (!addedNodes.has(packageName)) {
    addedNodes.set(packageName, new Map());
  }

  addedNodes.get(packageName).set(version, node);
  keyMap.set(path, node);

  return node;
}

function addV1Node(
  packageName: string,
  snapshot: NpmDependencyV1,
  path: string,
  addedNodes: Map<string, Map<string, ProjectGraphExternalNode>>,
  keyMap: Map<string, ProjectGraphExternalNode>,
  builder: ProjectGraphBuilder
) {
  const node = createNode(
    packageName,
    snapshot.version,
    path,
    addedNodes,
    keyMap
  );
  if (node) {
    builder.addExternalNode(node);
  }

  if (snapshot.dependencies) {
    Object.entries(snapshot.dependencies).forEach(([depName, depSnapshot]) => {
      addV1Node(
        depName,
        depSnapshot,
        `${path}/node_modules/${depName}`,
        addedNodes,
        keyMap,
        builder
      );
    });
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
    Object.keys(data.packages).forEach((path) => {
      const snapshot = data.packages[path];
      [
        snapshot.peerDependencies,
        snapshot.dependencies,
        snapshot.optionalDependencies,
      ].forEach((section) => {
        addNodeDependencies(path, section, builder, keyMap);
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

function addNodeDependencies(
  sourcePath: string,
  section: Record<string, string>,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  if (section) {
    const node = keyMap.get(sourcePath);
    // we are skipping workspaces packages
    if (!node) {
      return;
    }
    Object.entries(section).forEach(([name, versionRange]) => {
      const target = findTarget(sourcePath, name, versionRange, keyMap);
      if (target) {
        builder.addExternalNodeDependency(node.name, target.name);
      }
    });
  }
}

function findTarget(
  sourcePath: string,
  targetName: string,
  versionRange: string,
  keyMap: Map<string, ProjectGraphExternalNode>
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
    targetName,
    versionRange,
    keyMap
  );
}

function addV1NodeDependencies(
  path: string,
  snapshot: NpmDependencyV1,
  builder: ProjectGraphBuilder,
  keyMap: Map<string, ProjectGraphExternalNode>
) {
  addNodeDependencies(path, snapshot.requires, builder, keyMap);

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
        const target = findTarget(path, depName, depSpec, keyMap);
        if (target) {
          builder.addExternalNodeDependency(node.name, target.name);
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
  const { lockfileVersion, requires, name } = JSON.parse(
    rootLockFileContent
  ) as NpmLockFile;

  const mappedPackages = remapPackages(rootLockFile, graph);

  const output: NpmLockFile = {
    name: packageJson.name || rootLockFile.name,
    version: packageJson.version || '0.0.1',
    lockfileVersion: rootLockFile.lockfileVersion,
  };
  if (rootLockFile.requires) {
    output.requires = rootLockFile.requires;
  }
  if (lockfileVersion > 1) {
    output.packages = remapV3Packages(mappedPackages, packageJson);
  }
  if (lockfileVersion < 3) {
    output.dependencies = remapV1Packages(mappedPackages);
  }

  return JSON.stringify(output, null, 2);
}

function remapV3Packages(
  mappedPackages: RemappedPackage[],
  packageJson: NormalizedPackageJson
): Record<string, NpmDependencyV3> {
  const output: Record<string, NpmDependencyV3> = {};
  output[''] = packageJson;

  mappedPackages.forEach((p) => {
    output[p.path] = p.valueV3;
  });

  return output;
}

function remapV1Packages(
  mappedPackages: RemappedPackage[]
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

type RemappedPackage = {
  path: string;
  name: string;
  valueV3?: NpmDependencyV3;
  valueV1?: NpmDependencyV1;
};

function remapPackages(
  rootLockFile: NpmLockFile,
  graph: ProjectGraph
): RemappedPackage[] {
  const nestedNodes = new Set<ProjectGraphExternalNode>();
  const visitedNodes = new Map<ProjectGraphExternalNode, Set<string>>();
  const visitedPaths = new Set<string>();

  const remappedPackages: RemappedPackage[] = [];

  // add first level children
  Object.values(graph.externalNodes).forEach((node) => {
    if (node.name === `npm:${node.data.packageName}`) {
      const mappedPackage = remapPackage(
        rootLockFile,
        node.data.packageName,
        node.data.version
      );
      remappedPackages.push(mappedPackage);
      visitedNodes.set(node, new Set([mappedPackage.path]));
      visitedPaths.add(mappedPackage.path);
    } else {
      nestedNodes.add(node);
    }
  });

  if (nestedNodes.size) {
    const invertedGraph = reverse(graph);
    nestRemappedPackages(
      invertedGraph,
      remappedPackages,
      nestedNodes,
      visitedNodes,
      visitedPaths,
      rootLockFile
    );
  }

  return remappedPackages.sort((a, b) => a.path.localeCompare(b.path));
}

function remapPackage(
  rootLockFile: NpmLockFile,
  packageName: string,
  version: string,
  parentPath = ''
): RemappedPackage {
  const path = parentPath + `node_modules/${packageName}`;
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
    path,
    name: packageName,
    valueV1,
    valueV3,
  };
}

function nestRemappedPackages(
  invertedGraph: ProjectGraph,
  result: RemappedPackage[],
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
    if (invertedGraph.dependencies[node.name].length === 1) {
      const targetName = invertedGraph.dependencies[node.name][0].target;
      const targetNode = invertedGraph.externalNodes[targetName];

      if (visitedNodes.has(targetNode)) {
        visitedNodes.get(targetNode).forEach((path) => {
          const mappedPackage = remapPackage(
            rootLockFile,
            node.data.packageName,
            node.data.version,
            findParentPath(path, node.data.packageName, visitedPaths) + '/'
          );
          result.push(mappedPackage);
          if (visitedNodes.has(node)) {
            visitedNodes.get(node).add(mappedPackage.path);
          } else {
            visitedNodes.set(node, new Set([mappedPackage.path]));
          }
          visitedPaths.add(mappedPackage.path);
        });
        nestedNodes.delete(node);
      }
    }
  });

  if (initialSize === nestedNodes.size) {
    throw Error('Loop detected while pruning');
  } else {
    nestRemappedPackages(
      invertedGraph,
      result,
      nestedNodes,
      visitedNodes,
      visitedPaths,
      rootLockFile
    );
  }
}

function findParentPath(
  path: string,
  packageName: string,
  visitedPaths: Set<string>
): string {
  const segments = path.split('/node_modules/');
  let parentPath = path;
  while (
    segments.length > 1 &&
    !visitedPaths.has(`${parentPath}/node_modules/${packageName}`)
  ) {
    segments.pop();
    parentPath = segments.join('/node_modules/');
  }
  return parentPath;
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
