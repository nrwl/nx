import { join } from 'node:path/posix';
import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import type { ProjectConfiguration } from '../../../config/workspace-json-project-json';

export function getWorkspacePackagesMetadata<
  T extends ProjectGraphProjectNode | ProjectConfiguration
>(
  projects: Record<string, T>
): {
  entryPointsToProjectMap: Record<string, T>;
  wildcardEntryPointsToProjectMap: Record<string, T>;
  packageToProjectMap: Record<string, T>;
} {
  const entryPointsToProjectMap: Record<string, T> = {};
  const wildcardEntryPointsToProjectMap: Record<string, T> = {};
  const packageToProjectMap: Record<string, T> = {};
  for (const project of Object.values(projects)) {
    const metadata =
      'data' in project ? project.data.metadata : project.metadata;

    if (!metadata?.js) {
      continue;
    }

    const {
      packageName,
      packageExports,
      packageMain,
      isInPackageManagerWorkspaces,
    } = metadata.js;
    packageToProjectMap[packageName] = project;

    if (!isInPackageManagerWorkspaces) {
      // it is not included in the package manager workspaces config, so we
      // skip it since the exports information wouldn't be used by the Node.js
      // resolution
      continue;
    }

    if (packageExports) {
      if (typeof packageExports === 'string') {
        // it points to a file, which would be the equivalent of an '.' export,
        // in which case the package name is the entry point
        entryPointsToProjectMap[packageName] = project;
      } else {
        for (const entryPoint of Object.keys(packageExports)) {
          if (packageExports[entryPoint] === null) {
            // if the entry point is restricted, we skip it
            continue;
          }

          if (entryPoint.startsWith('.')) {
            // it is a relative subpath export
            if (entryPoint.includes('*')) {
              wildcardEntryPointsToProjectMap[join(packageName, entryPoint)] =
                project;
            } else {
              entryPointsToProjectMap[join(packageName, entryPoint)] = project;
            }
          } else {
            // it's a conditional export, so we use the package name as the entry point
            // https://nodejs.org/api/packages.html#conditional-exports
            entryPointsToProjectMap[packageName] = project;
          }
        }
      }
    } else if (packageMain) {
      // if there is no exports, but there is a main, the package name is the
      // entry point
      entryPointsToProjectMap[packageName] = project;
    }
  }

  return {
    entryPointsToProjectMap,
    wildcardEntryPointsToProjectMap,
    packageToProjectMap,
  };
}

// Pre-compiled pattern structure for efficient matching
type CompiledWildcardPattern<T> = {
  key: string;
  prefix: string;
  suffix: string;
  project: T;
};

// Cache for compiled patterns keyed by the wildcardEntryPointsToProjectMap reference
const compiledPatternCache = new WeakMap<
  Record<string, any>,
  CompiledWildcardPattern<any>[]
>();

// adapted from PACKAGE_IMPORTS_EXPORTS_RESOLVE at
// https://nodejs.org/docs/latest-v22.x/api/esm.html#resolution-algorithm-specification
export function matchImportToWildcardEntryPointsToProjectMap<
  T extends ProjectGraphProjectNode | ProjectConfiguration
>(
  wildcardEntryPointsToProjectMap: Record<string, T>,
  importPath: string
): T | null {
  // Get or create compiled patterns for this map
  let patterns = compiledPatternCache.get(wildcardEntryPointsToProjectMap);
  if (!patterns) {
    patterns = [];
    for (const key of Object.keys(wildcardEntryPointsToProjectMap)) {
      const segments = key.split('*');
      if (segments.length !== 2) {
        continue;
      }
      patterns.push({
        key,
        prefix: segments[0],
        suffix: segments[1],
        project: wildcardEntryPointsToProjectMap[key],
      });
    }
    // Sort by prefix length descending for longest-match-first
    patterns.sort((a, b) => b.prefix.length - a.prefix.length);
    compiledPatternCache.set(wildcardEntryPointsToProjectMap, patterns);
  }

  // Find first matching pattern (guaranteed longest prefix due to sorting)
  for (const pattern of patterns) {
    if (pattern.prefix === importPath) {
      continue;
    }
    if (!importPath.startsWith(pattern.prefix)) {
      continue;
    }
    if (
      pattern.suffix.length > 0 &&
      (!importPath.endsWith(pattern.suffix) ||
        importPath.length < pattern.prefix.length + pattern.suffix.length)
    ) {
      continue;
    }
    return pattern.project;
  }

  return null;
}
