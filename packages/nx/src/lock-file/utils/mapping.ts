import { workspaceRoot } from '../../utils/workspace-root';
import { existsSync, readFileSync } from 'fs';
import {
  LockFileData,
  PackageDependency,
  PackageVersions,
} from './lock-file-type';
import { ProjectGraphBuilder } from '../../project-graph/project-graph-builder';

export type TransitiveLookupFunctionInput = {
  packageName: string;
  parentPackages: string[];
  versions: PackageVersions;
  version: string;
};

type TransitiveLookupFunction = (
  data: TransitiveLookupFunctionInput
) => PackageDependency;

/**
 * Checks whether the package is a root dependency
 * @param packageName
 * @param version
 * @returns
 */
export function isRootVersion(packageName: string, version: string): boolean {
  const fullPath = `${workspaceRoot}/node_modules/${packageName}/package.json`;

  if (existsSync(fullPath)) {
    const content = readFileSync(fullPath, 'utf-8');
    return JSON.parse(content).version === version;
  } else {
    return false;
  }
}

// Finds the maching version of each dependency of the package and
// maps each {package}:{versionRange} pair to "npm:{package}@{version}" (when transitive) or "npm:{package}" (when root)
function mapTransitiveDependencies(
  parentPackages: string[],
  packages: Record<string, PackageVersions>,
  dependencies: Record<string, string>,
  versionCache: Record<string, string>,
  transitiveLookupFn: TransitiveLookupFunction
): string[] {
  if (!dependencies) {
    return [];
  }

  const result: string[] = [];

  Object.keys(dependencies).forEach((packageName) => {
    const versions = packages[packageName];
    // some of the peer dependencies might not be installed,
    // we don't have them as nodes in externalNodes
    // so there's no need to map them as dependencies
    if (!versions) {
      return;
    }

    // fix for pnpm versions that might have suffixes - `1.2.3_@babel+core@4.5.6`
    const version = dependencies[packageName].split('_')[0];
    const key = `${packageName}@${version}`;

    // if we already processed this dependency, use the version from the cache
    if (versionCache[key]) {
      result.push(versionCache[key]);
    } else {
      let matchedVersion: string;
      let isRootVersion: boolean;
      if (versions[`${packageName}@${version}`]) {
        matchedVersion = version;
        isRootVersion = versions[`${packageName}@${version}`].rootVersion;
      } else {
        const transitiveLookupResult = transitiveLookupFn({
          packageName,
          parentPackages,
          versions,
          version,
        });
        matchedVersion = transitiveLookupResult?.version;
        isRootVersion = transitiveLookupResult?.rootVersion;
      }

      // for some peer dependencies, we won't find installed version so we'll just ignore these
      if (matchedVersion) {
        const nodeName = getNodeName(
          packageName,
          matchedVersion,
          isRootVersion
        );
        result.push(nodeName);
        versionCache[key] = nodeName;
      }
    }
  });

  return result;
}

/**
 * Returns node name depending on whether it's root version or nested
 */
export function getNodeName(
  dep: string,
  version: string,
  rootVersion: boolean
): `npm:${string}` {
  return rootVersion ? `npm:${dep}` : `npm:${dep}@${version}`;
}

/**
 * Maps the lockfile data to the partial project graph
 * using package manager specific {@link TransitiveLookupFunction}
 *
 * @param lockFileData
 * @param transitiveLookupFn
 * @returns
 */
export function mapExternalNodes(
  lockFileData: LockFileData,
  transitiveLookupFn: TransitiveLookupFunction
) {
  const builder = new ProjectGraphBuilder();

  const versionCache: Record<string, string> = {};
  const transitiveDepsToTraverse: [string, string, Record<string, string>][] =
    [];

  Object.entries(lockFileData.dependencies).forEach(
    ([packageName, versions]) => {
      Object.values(versions).forEach(
        ({ version, rootVersion, dependencies, peerDependencies }) => {
          // save external node
          const nodeName = getNodeName(packageName, version, rootVersion);

          builder.addExternalNode({
            type: 'npm',
            name: nodeName,
            data: {
              version,
              packageName,
            },
          });

          // combine dependencies and peerDependencies
          const allDependencies =
            dependencies || peerDependencies
              ? {
                  ...(dependencies || {}),
                  ...(peerDependencies || {}),
                }
              : undefined;

          if (allDependencies) {
            transitiveDepsToTraverse.push([
              packageName,
              nodeName,
              allDependencies,
            ]);
          }
        }
      );
    }
  );
  transitiveDepsToTraverse.forEach(([packageName, nodeName, dependencies]) => {
    const transitiveDeps = mapTransitiveDependencies(
      [packageName],
      lockFileData.dependencies,
      dependencies,
      versionCache,
      transitiveLookupFn
    );
    transitiveDeps.forEach((target) => {
      builder.addExternalNodeDependency(nodeName, target);
    });
  });

  return builder.getUpdatedProjectGraph();
}
