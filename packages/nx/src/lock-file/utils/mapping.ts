import { ProjectGraph } from '../../config/project-graph';
import { workspaceRoot } from '../../utils/workspace-root';
import { existsSync, readFileSync } from 'fs';
import {
  LockFileData,
  PackageDependency,
  PackageVersions,
} from './lock-file-type';

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

export type TransitiveLookupFunctionInput = {
  packageName: string;
  parentPackages: string[];
  versions: PackageVersions;
  version: string;
};

type TransitiveLookupFunction = (
  data: TransitiveLookupFunctionInput
) => PackageDependency;

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
      const matchedVersion = versions[`${packageName}@${version}`]
        ? version
        : transitiveLookupFn({
            packageName,
            parentPackages,
            versions,
            version,
          })?.version;

      // for some peer dependencies, we won't find installed version so we'll just ignore these
      if (matchedVersion) {
        const nodeName = getNodeName(
          packageName,
          matchedVersion,
          versions[`${packageName}@${matchedVersion}`]?.rootVersion
        );
        result.push(nodeName);
        versionCache[key] = nodeName;
      }
    }
  });

  return result;
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

export function mapExternalNodes(
  lockFileData: LockFileData,
  transitiveLookupFn: TransitiveLookupFunction
) {
  const result: ProjectGraph = {
    dependencies: {},
    externalNodes: {},
    nodes: {},
  };
  const versionCache: Record<string, string> = {};

  Object.entries(lockFileData.dependencies).forEach(
    ([packageName, versions]) => {
      Object.values(versions).forEach(
        ({ version, rootVersion, dependencies, peerDependencies }) => {
          // save external node
          const nodeName = getNodeName(packageName, version, rootVersion);
          result.externalNodes[nodeName] = {
            type: 'npm',
            name: nodeName,
            data: {
              version,
              packageName,
            },
          };

          const combinedDependencies =
            dependencies || peerDependencies
              ? {
                  ...(dependencies || {}),
                  ...(peerDependencies || {}),
                }
              : undefined;

          if (combinedDependencies) {
            const nodeDependencies = [];
            const transitiveDeps = mapTransitiveDependencies(
              [packageName],
              lockFileData.dependencies,
              combinedDependencies,
              versionCache,
              transitiveLookupFn
            );
            transitiveDeps.forEach((target) => {
              nodeDependencies.push({
                type: 'static',
                source: nodeName,
                target,
              });
            });
            result.dependencies[nodeName] = nodeDependencies;
          }
        }
      );
    }
  );
  return result;
}
