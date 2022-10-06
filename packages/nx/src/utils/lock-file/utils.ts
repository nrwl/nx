import { satisfies } from 'semver';
import { defaultHashing } from '../../hasher/hashing-impl';
import { PackageDependency, PackageVersions } from './lock-file-type';
import { workspaceRoot } from '../workspace-root';
import { existsSync, readFileSync } from 'fs';
import {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphExternalNode,
} from '../../config/project-graph';

/**
 * Simple sort function to ensure keys are ordered alphabetically
 * @param obj
 * @returns
 */
export function sortObject<T = string>(
  obj: Record<string, T>,
  valueTransformator: (value: T) => any = (value) => value,
  descending = false
): Record<string, T> | undefined {
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    return;
  }
  keys.sort();
  if (descending) {
    keys.reverse();
  }
  const result: Record<string, T> = {};
  keys.forEach((key) => {
    result[key] = valueTransformator(obj[key]);
  });
  return result;
}

/**
 * Apply simple hashing of the content using the default hashing implementation
 * @param fileContent
 * @returns
 */
export function hashString(fileContent: string): string {
  return defaultHashing.hashArray([fileContent]);
}

export function findMatchingVersion(
  packageName: string,
  packageVersions: PackageVersions,
  version: string
): string {
  // if it's fixed version, just return it
  if (packageVersions[`${packageName}@${version}`]) {
    return version;
  }
  // otherwise search for the matching version
  return Object.values(packageVersions).find((v) =>
    satisfies(v.version, version)
  )?.version;
}

export function isRootVersion(packageName: string, version: string): boolean {
  const fullPath = `${workspaceRoot}/node_modules/${packageName}/package.json`;
  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content).version === version;
  } else {
    return false;
  }
}

/**
 * Returns node name depending whether it's root version or nested
 */
export function getNodeName(
  dep: string,
  version: string,
  rootVersion: boolean
): `npm:${string}` {
  return rootVersion ? `npm:${dep}` : `npm:${dep}@${version}`;
}

export function mapExternalNodeDependencies(
  nodeName: string,
  packageVersion: PackageDependency,
  dependencies: Record<string, PackageVersions>,
  versionCache: Record<string, string>
) {
  const result = [];

  const combinedDependencies =
    packageVersion.dependencies || packageVersion.peerDependencies
      ? {
          ...(packageVersion.dependencies || {}),
          ...(packageVersion.peerDependencies || {}),
        }
      : undefined;
  const transitiveDeps = mapTransitiveDependencies(
    dependencies,
    combinedDependencies,
    versionCache
  );
  // map transitive dependencies to dependencies hash map
  transitiveDeps.forEach((dep) => {
    result.push({
      type: 'static',
      source: nodeName,
      target: dep,
    });
  });

  return result;
}

// Finds the maching version of each dependency of the package and
// maps each {package}:{versionRange} pair to "npm:{package}@{version}" (when transitive) or "npm:{package}" (when root)
function mapTransitiveDependencies(
  packages: Record<string, PackageVersions>,
  dependencies: Record<string, string>,
  versionCache: Record<string, string>
): string[] {
  if (!dependencies) {
    return [];
  }
  const result: string[] = [];

  Object.keys(dependencies).forEach((packageName) => {
    const cleanVersion = dependencies[packageName].split('_')[0];
    const key = `${packageName}@${cleanVersion}`;

    // some of the peer dependencies might not be installed,
    // we don't have them as nodes in externalNodes
    // so there's no need to map them as dependencies
    if (!packages[packageName]) {
      return;
    }

    // if we already processed this dependency, use the version from the cache
    if (versionCache[key]) {
      result.push(versionCache[key]);
    } else {
      const versions = packages[packageName];
      const version = findMatchingVersion(packageName, versions, cleanVersion);
      // for some peer dependencies, we won't find installed version so we'll just ignore those
      if (version) {
        const nodeName = getNodeName(
          packageName,
          version,
          versions[`${packageName}@${version}`]?.rootVersion
        );
        result.push(nodeName);
        versionCache[key] = nodeName;
      }
    }
  });

  return result;
}

export function hashExternalNodes(projectGraph: ProjectGraph) {
  Object.keys(projectGraph.externalNodes).forEach((key) => {
    if (!projectGraph.externalNodes[key].data.hash) {
      // hash it using it's dependencies
      hashExternalNode(projectGraph.externalNodes[key], projectGraph);
    }
  });
}

function hashExternalNode(node: ProjectGraphExternalNode, graph: ProjectGraph) {
  const hashKey = `${node.data.packageName}@${node.data.version}`;
  if (!graph.dependencies[node.name]) {
    node.data.hash = hashString(hashKey);
  } else {
    const hashingInput = [hashKey];
    traverseExternalNodesDependencies(node.name, graph, hashingInput);
    node.data.hash = defaultHashing.hashArray(hashingInput.sort());
  }
}

function traverseExternalNodesDependencies(
  projectName: string,
  graph: ProjectGraph,
  visited: string[]
) {
  graph.dependencies[projectName].forEach((d) => {
    const target = graph.externalNodes[d.target];
    const targetKey = `${target.data.packageName}@${target.data.version}`;
    if (visited.indexOf(targetKey) === -1) {
      visited.push(targetKey);
      if (graph.dependencies[d.target]) {
        traverseExternalNodesDependencies(d.target, graph, visited);
      }
    }
  });
}
