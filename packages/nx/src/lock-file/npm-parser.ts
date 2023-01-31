import { existsSync, readFileSync } from 'fs-extra';
import { workspaceRoot } from '../utils/workspace-root';
import { LockFileBuilder } from './lock-file-builder';
import {
  LockFileNode,
  NpmDependencyV1,
  NpmDependencyV3,
  NpmLockFile,
} from './utils/types';
import { satisfies } from 'semver';
import { NormalizedPackageJson } from './utils/types';
import { addEdgeOuts } from './utils/parsing-utils';
import { ProjectGraphBuilder } from '../project-graph/project-graph-builder';
import {
  ProjectGraph,
  ProjectGraphExternalNode,
} from '../config/project-graph';

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
    // TODO: use packages
    Object.entries(data.packages).forEach(([path, snapshot]) => {
      // skip workspaces packages
      if (path === '' || !path.includes('node_modules') || snapshot.link) {
        return;
      }

      const packageName = path.split('node_modules/').pop();
      const version = findV3Version(snapshot, packageName);
      // we don't need to keep duplicates, we can just track the keys
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

export function stringifyNpmLockfile(
  graph: ProjectGraph,
  rootLockFileContent: string,
  packageJson: NormalizedPackageJson
): string {
  const { lockfileVersion, dependencies, packages, requires, name } =
    JSON.parse(rootLockFileContent) as NpmLockFile;

  const output: NpmLockFile = {
    lockfileVersion,
    requires,
    name: packageJson.name || name,
    version: packageJson.version || '0.0.1',
    // dependencies
    // packages
  };

  return JSON.stringify(output, null, 2);
}

// export function pruneNpmLockFile(
//   rootLockFileContent: string,
//   packageJson: PackageJson,
//   prunedPackageJson: NormalizedPackageJson
// ): string {
//   const rootLockFile = JSON.parse(rootLockFileContent) as NpmLockFile;
//   const builder = buildLockFileGraph(rootLockFile, packageJson);
//   builder.prune(prunedPackageJson);

//   const mappedPackages = remapPackages(
//     rootLockFile,
//     builder.nodes,
//     rootLockFile.lockfileVersion
//   );

//   const prunedLockFile: NpmLockFile = {
//     name: prunedPackageJson.name,
//     version: prunedPackageJson.version,
//     lockfileVersion: rootLockFile.lockfileVersion,
//     requires: true,
//   };
//   if (rootLockFile.lockfileVersion > 1) {
//     prunedLockFile.packages = {
//       '': prunedPackageJson,
//     };
//     mappedPackages.forEach((p) => {
//       prunedLockFile.packages[p.path] = p.valueV3;
//     });
//   }
//   if (rootLockFile.lockfileVersion < 3) {
//     prunedLockFile.dependencies = {};
//     mappedPackages.forEach((p) => {
//       getDependencyParent(p.path, prunedLockFile.dependencies)[p.name] =
//         p.valueV1;
//     });
//   }

//   return JSON.stringify(prunedLockFile, null, 2);
// }

function getDependencyParent(
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
  valueV3?: NpmDependencyV3 | NormalizedPackageJson;
  valueV1?: NpmDependencyV1;
};

function remapPackages(
  rootLockFile: NpmLockFile,
  nodes: Map<string, LockFileNode>,
  lockfileVersion: number
): RemappedPackage[] {
  const nestedNodes = new Set<LockFileNode>();
  const visitedNodes = new Map<LockFileNode, Set<string>>();
  const visitedPaths = new Set<string>();

  const result: RemappedPackage[] = [];

  // add first level children
  nodes.forEach((node) => {
    if (node.isHoisted) {
      const mappedPackage = remapPackage(
        lockfileVersion,
        rootLockFile,
        node.name,
        node.version,
        node.packageName
      );
      result.push(mappedPackage);
      visitedNodes.set(node, new Set([mappedPackage.path]));
      visitedPaths.add(mappedPackage.path);
    } else {
      nestedNodes.add(node);
    }
  });

  exhaustRemappedPackages(
    result,
    nestedNodes,
    visitedNodes,
    visitedPaths,
    lockfileVersion,
    rootLockFile
  );

  return result.sort((a, b) => a.path.localeCompare(b.path));
}

function remapPackage(
  lockfileVersion: number,
  rootLockFile: NpmLockFile,
  name: string,
  version: string,
  packageName: string,
  parentPath = ''
): RemappedPackage {
  const path = parentPath + `node_modules/${name}`;
  let valueV3, valueV1;
  if (lockfileVersion < 3) {
    valueV1 = findMatchingPackageV1(
      rootLockFile.dependencies,
      name,
      version,
      packageName
    );
  }
  if (lockfileVersion > 1) {
    valueV3 = findMatchingPackageV3(rootLockFile.packages, name, version);
  }

  return {
    path,
    name,
    valueV1,
    valueV3,
  };
}

function exhaustRemappedPackages(
  result: RemappedPackage[],
  nestedNodes: Set<LockFileNode>,
  visitedNodes: Map<LockFileNode, Set<string>>,
  visitedPaths: Set<string>,
  lockfileVersion: number,
  rootLockFile: NpmLockFile
) {
  const initialSize = nestedNodes.size;

  if (!initialSize) {
    return;
  }

  nestedNodes.forEach((node) => {
    if (node.edgesIn.size === 1) {
      let found = false;
      node.edgesIn.forEach((edge) => {
        if (visitedNodes.has(edge.from)) {
          found = true;
          findParentPaths(
            visitedNodes.get(edge.from),
            visitedPaths,
            node.name
          ).forEach((parentPath) => {
            const mappedPackage = remapPackage(
              lockfileVersion,
              rootLockFile,
              node.name,
              node.version,
              node.packageName,
              parentPath + '/'
            );
            result.push(mappedPackage);
            if (visitedNodes.has(node)) {
              visitedNodes.get(node).add(mappedPackage.path);
            } else {
              visitedNodes.set(node, new Set([mappedPackage.path]));
            }
            visitedPaths.add(mappedPackage.path);
          });
        }
      });
      if (found) {
        nestedNodes.delete(node);
      }
    }
  });

  if (initialSize === nestedNodes.size) {
    throw Error('Loop detected while pruning');
  } else {
    exhaustRemappedPackages(
      result,
      nestedNodes,
      visitedNodes,
      visitedPaths,
      lockfileVersion,
      rootLockFile
    );
  }
}

function findParentPaths(
  paths: Set<string>,
  visitedPaths: Set<string>,
  name: string
): Set<string> {
  const suffix = `node_modules/${name}`;
  const results = new Set<string>();
  paths.forEach((path) => {
    const segments = path.split(/\/node_modules\//);
    while (
      segments.length
        ? !visitedPaths.has(segments.join('/node_modules/') + '/' + suffix)
        : !visitedPaths.has(suffix)
    ) {
      path = segments.join('/node_modules/');
      segments.pop();
    }
    results.add(path);
  });
  return results;
}

function findMatchingPackageV3(
  packages: Record<string, NpmDependencyV3>,
  name: string,
  version: string
) {
  const keys = Object.keys(packages);
  for (let i = 0; i < keys.length; i++) {
    const { dev, peer, ...value } = packages[keys[i]];
    if (
      keys[i].endsWith(`node_modules/${name}`) &&
      (value.version === version || value.resolved === version)
    ) {
      return value;
    }
  }
}

function findMatchingPackageV1(
  packages: Record<string, NpmDependencyV1>,
  name: string,
  version: string,
  packageName: string
) {
  const keys = Object.keys(packages);
  for (let i = 0; i < keys.length; i++) {
    const { dependencies, dev, peer, ...value } = packages[keys[i]];
    if (keys[i] === name) {
      if (value.version === version) {
        return value;
      }
      // for alias packages we need to check if version has packageName as well
      if (packageName && value.version.endsWith(`${packageName}@${version}`)) {
        return value;
      }
    }
    if (dependencies) {
      const found = findMatchingPackageV1(
        dependencies,
        name,
        version,
        packageName
      );
      if (found) {
        return found;
      }
    }
  }
}

/**********************************************
 * V3 lock file related logic
 *********************************************/

function parseV1LockFile(
  builder: LockFileBuilder,
  dependencies: Record<string, NpmDependencyV1>
) {
  if (dependencies) {
    Object.entries(dependencies).forEach(([packageName, value]) => {
      parseV1Dependency(dependencies, packageName, value, builder);
    });
  }
}

function parseV1Dependency(
  dependencies: Record<string, NpmDependencyV1>,
  packageName: string,
  value: NpmDependencyV1,
  builder: LockFileBuilder,
  { isHoisted, parents }: { isHoisted: boolean; parents: string[] } = {
    isHoisted: true,
    parents: [],
  }
) {
  let pathSegments = [...parents];
  if (!value.version.startsWith('file:')) {
    const node = parseV1Node(packageName, value, isHoisted);
    builder.addNode(node);
    builder.addEdgeIn(node, value.version);

    pathSegments.push(packageName);
    if (value.requires) {
      Object.entries(value.requires).forEach(([depName, depSpec]) => {
        const matchedVersion = findV1EdgeVersion(
          dependencies,
          pathSegments,
          depName,
          depSpec
        );
        builder.addEdgeOut(node, depName, matchedVersion);
      });
    }
    const { peerDependencies, peerDependenciesMeta } = getPeerDependencies(
      `node_modules/${pathSegments.join('/node_modules/')}`
    );
    if (peerDependencies) {
      Object.entries(peerDependencies).forEach(([depName, depSpec]) => {
        if (!node.edgesOut?.has(depName)) {
          const isOptional = peerDependenciesMeta?.[depName]?.optional;
          let matchedVersion = findV1EdgeVersion(
            dependencies,
            pathSegments,
            depName,
            depSpec
          );
          if (!matchedVersion && isOptional) {
            matchedVersion = depSpec;
          }
          builder.addEdgeOut(node, depName, matchedVersion, isOptional);
        }
      });
    }
  }

  if (value.dependencies) {
    Object.entries(value.dependencies).forEach(([depPackageName, depValue]) => {
      parseV1Dependency(dependencies, depPackageName, depValue, builder, {
        isHoisted: false,
        parents: pathSegments,
      });
    });
  }
}

function findV1EdgeVersion(
  dependencies: Record<string, NpmDependencyV1>,
  pathSegments: string[],
  name: string,
  versionSpec: string
): string {
  if (!dependencies && !pathSegments.length) {
    return;
  }
  let version;
  const depVersion = dependencies[name]?.version;
  if (depVersion && satisfies(depVersion, versionSpec)) {
    version = depVersion;
  }
  if (!pathSegments.length) {
    return version;
  }
  return (
    findV1EdgeVersion(
      dependencies[pathSegments[0]].dependencies,
      pathSegments.slice(1),
      name,
      versionSpec
    ) || version
  );
}

function parseV1Node(
  name: string,
  value: NpmDependencyV1,
  isHoisted = false
): LockFileNode {
  let version = value.version;
  let packageName;

  // alias packages have versions in the form of `npm:packageName@version`
  // the name from the node_modules would not match the actual package name
  if (version?.startsWith('npm:')) {
    const versionStartIndex = version.lastIndexOf('@');
    packageName = version.slice(4, versionStartIndex);
    version = version.slice(versionStartIndex + 1); // we don't need `@`
  }

  const node: LockFileNode = {
    name,
    ...(packageName && { packageName }),
    ...(version && { version }),
    isHoisted,
  };
  return node;
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

/**********************************************
 * V3 lock file related logic
 *********************************************/

function parseV3LockFile(
  builder: LockFileBuilder,
  packages: Record<string, NpmDependencyV3>
) {
  if (packages) {
    Object.entries(packages).forEach(([path, value]) => {
      if (path === '' || !path.includes('node_modules') || value.link) {
        return; // skip workspaces packages
      }

      const isHoisted = !path.includes('/node_modules/');
      const node = parseV3Node(path, value, isHoisted);
      builder.addNode(node);
      builder.addEdgeIn(
        node,
        node.packageName
          ? `npm:${node.packageName}@${node.version}`
          : node.version
      );
      addEdgeOuts({
        builder,
        node,
        section: value.peerDependencies,
        isOptional: true,
        depSpecFunc: (depName, depSpec) =>
          findV3EdgeVersion(packages, path, depName, depSpec, true),
      });
      addEdgeOuts({
        builder,
        node,
        section: value.dependencies,
        depSpecFunc: (depName, depSpec) =>
          findV3EdgeVersion(packages, path, depName, depSpec),
      });
      addEdgeOuts({
        builder,
        node,
        section: value.optionalDependencies,
        depSpecFunc: (depName, depSpec) =>
          findV3EdgeVersion(packages, path, depName, depSpec),
      });
    });
  }
}

function findV3EdgeVersion(
  packages: Record<string, NpmDependencyV3>,
  path: string,
  name: string,
  versionSpec: string,
  optionalOrPeer?: boolean // depending on installation, not all peer deps will be installed
): string {
  if (path && !path.endsWith('/')) {
    path = path + '/';
  }
  let child = packages[`${path}node_modules/${name}`];
  if (child && satisfies(child.version, versionSpec)) {
    return child.version;
  }
  if (!path) {
    if (!optionalOrPeer) {
      throw new Error(
        `Could not find version for ${name} with spec ${versionSpec} in the lock file`
      );
    }
    return versionSpec;
  }
  let parentPath = path.slice(0, path.lastIndexOf('node_modules'));
  // workspace packages do not start with node_modules
  if (parentPath === path || parentPath + '/' === path) {
    parentPath = '';
  }
  return findV3EdgeVersion(
    packages,
    parentPath,
    name,
    versionSpec,
    optionalOrPeer
  );
}

// parse node value from lock file into `LockFileNode`
function parseV3Node(
  path: string,
  value: NpmDependencyV3,
  isHoisted: boolean
): LockFileNode {
  const name = path.split('node_modules/').pop();
  let version = value.version;
  let packageName;

  const resolved = value.resolved;
  // for tarball packages version might not exist or be useless
  if (!version || (resolved && !resolved.includes(version))) {
    version = resolved;
  }
  // for alias packages name is set
  packageName = value.name && value.name !== name ? value.name : undefined;

  const node: LockFileNode = {
    name,
    ...(packageName && { packageName }),
    ...(version && { version }),
    isHoisted,
  };

  return node;
}
