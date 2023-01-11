import { existsSync, readFileSync } from 'fs';
import { PackageJson } from '../utils/package-json';
import { workspaceRoot } from '../utils/workspace-root';
import { LockFileBuilder } from './lock-file-builder';
import {
  LockFileGraph,
  LockFileNode,
  NpmDependencyV1,
  NpmDependencyV3,
  NpmLockFile,
} from './utils/types';
import { satisfies } from 'semver';
import { NormalizedPackageJson } from './utils/pruning-utils';
import { normalizeNpmPackageJson } from './utils/npm-utils';
import { addEdgeOuts } from './utils/parsing-utils';

export function parseNpmLockFile(
  lockFileContent: string,
  packageJson: PackageJson
): LockFileGraph {
  const rootLockFile = JSON.parse(lockFileContent) as NpmLockFile;
  const builder = buildLockFileGraph(rootLockFile, packageJson);
  return builder.getLockFileGraph();
}

export function pruneNpmLockFile(
  rootLockFileContent: string,
  packageJson: PackageJson,
  prunedPackageJson: NormalizedPackageJson
): string {
  const rootLockFile = JSON.parse(rootLockFileContent) as NpmLockFile;
  const builder = buildLockFileGraph(rootLockFile, packageJson);
  builder.prune(prunedPackageJson);

  const mappedPackages = remapPackages(
    rootLockFile,
    builder.nodes,
    rootLockFile.lockfileVersion
  );

  const prunedLockFile: NpmLockFile = {
    name: prunedPackageJson.name,
    version: prunedPackageJson.version,
    lockfileVersion: rootLockFile.lockfileVersion,
    requires: true,
  };
  if (rootLockFile.lockfileVersion > 1) {
    prunedLockFile.packages = {
      '': prunedPackageJson,
    };
    mappedPackages.forEach((p) => {
      prunedLockFile.packages[p.path] = p.valueV3;
    });
  }
  if (rootLockFile.lockfileVersion < 3) {
    prunedLockFile.dependencies = {};
    mappedPackages.forEach((p) => {
      getDependencyParent(p.path, prunedLockFile.dependencies)[p.name] =
        p.valueV1;
    });
  }

  return JSON.stringify(prunedLockFile, null, 2);
}

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
        node.version
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
  parentPath = ''
): RemappedPackage {
  const path = parentPath + `node_modules/${name}`;
  let valueV3, valueV1;
  if (lockfileVersion < 3) {
    valueV1 = findMatchingPackage(rootLockFile.dependencies, name, version);
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
    if (keys[i].endsWith(`node_modules/${name}`) && value.version === version) {
      return value;
    }
  }
}

function findMatchingPackage(
  packages: Record<string, NpmDependencyV1>,
  name: string,
  version: string
) {
  const keys = Object.keys(packages);
  for (let i = 0; i < keys.length; i++) {
    const { dependencies, dev, peer, ...value } = packages[keys[i]];
    if (keys[i] === name && value.version === version) {
      return value;
    }
    if (dependencies) {
      const found = findMatchingPackage(dependencies, name, version);
      if (found) {
        return found;
      }
    }
  }
}

function buildLockFileGraph(
  data: NpmLockFile,
  packageJson: PackageJson
): LockFileBuilder {
  const isLockFileV1 = data.lockfileVersion === 1;

  const normalizedPackageJson = normalizeNpmPackageJson(
    packageJson,
    isLockFileV1 ? data.dependencies : data.packages,
    isLockFileV1
  );

  const builder = new LockFileBuilder(normalizedPackageJson, {
    includeOptional: true,
  });

  isLockFileV1
    ? parseV1LockFile(builder, data.dependencies)
    : parseV3LockFile(builder, data.packages); // we will treat V2 lockfile as V3 but map it back to V2 for backwards compatibility

  return builder;
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
  const node = parseV1Node(packageName, value, isHoisted);
  builder.addNode(node);
  builder.addEdgeIn(node, value.version);

  const pathSegments = [...parents, packageName];
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
      if (path === '') {
        return; // skip root package (it's already added
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
      if (value.peerDependencies) {
        const peerMeta = value.peerDependenciesMeta || {};
        Object.entries(value.peerDependencies).forEach(([depName, depSpec]) => {
          builder.addEdgeOut(
            node,
            depName,
            findV3EdgeVersion(
              packages,
              path,
              depName,
              depSpec,
              peerMeta[depName]?.optional
            ),
            peerMeta[depName]?.optional
          );
        });
      }
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
  optional?: boolean
): string {
  if (path && !path.endsWith('/')) {
    path = path + '/';
  }
  let child = packages[`${path}node_modules/${name}`];
  if (child && satisfies(child.version, versionSpec)) {
    return child.version;
  }
  if (!path) {
    if (!optional) {
      throw `Could not find version for ${name} with spec ${versionSpec} in the lock file`;
    }
    return versionSpec;
  }
  const parentPath = path.slice(0, path.lastIndexOf('node_modules'));
  return findV3EdgeVersion(packages, parentPath, name, versionSpec, optional);
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
