import { join } from 'node:path/posix';
import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import type { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import type { PackageJsonProjectMetadata } from '../../../utils/package-json';

function getPackageTargets(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(getPackageTargets);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(getPackageTargets);
  }
  return [];
}

export function getWorkspacePackagesMetadata<
  T extends ProjectGraphProjectNode | ProjectConfiguration,
>(
  projects: Record<string, T>
): {
  entryPointsToProjectMap: Record<string, T>;
  wildcardEntryPointsToProjectMap: Record<string, T>;
  packageToProjectMap: Record<string, T>;
  ambiguousEntryPoints: Set<string>;
  entryPointsWithProjectBoundaryCrossings: Set<string>;
} {
  const entryPointsToProjectMap: Record<string, T> = {};
  const wildcardEntryPointsToProjectMap: Record<string, T> = {};
  const packageToProjectMap: Record<string, T> = {};
  const ambiguousEntryPoints = new Set<string>();
  const entryPointsWithProjectBoundaryCrossings = new Set<string>();
  const projectRoots = Object.values(projects)
    .map((project) => ({
      project,
      root: join('data' in project ? project.data.root : project.root),
    }))
    .sort((a, b) => b.root.length - a.root.length);
  const projectRootByProject = new Map(
    projectRoots.map(({ project, root }) => [project, root])
  );
  const addEntryPoint = (
    entryPoint: string,
    project: T,
    packageTargets: string[]
  ): void => {
    const existingProject = entryPointsToProjectMap[entryPoint];
    if (existingProject && existingProject !== project) {
      ambiguousEntryPoints.add(entryPoint);
    }
    const projectRoot = projectRootByProject.get(project)!;
    if (
      packageTargets.some((target) => {
        const targetPath = join(projectRoot, target);
        const targetProject = projectRoots.find(
          (candidate) =>
            candidate.root === '.' ||
            targetPath === candidate.root ||
            targetPath.startsWith(`${candidate.root}/`)
        );
        return targetProject && targetProject.project !== project;
      })
    ) {
      entryPointsWithProjectBoundaryCrossings.add(entryPoint);
    }
    entryPointsToProjectMap[entryPoint] = project;
  };

  for (const project of Object.values(projects)) {
    const metadata = (
      'data' in project ? project.data.metadata : project.metadata
    ) as PackageJsonProjectMetadata;

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
        addEntryPoint(packageName, project, [packageExports]);
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
              addEntryPoint(
                join(packageName, entryPoint),
                project,
                getPackageTargets(packageExports[entryPoint])
              );
            }
          } else {
            // it's a conditional export, so we use the package name as the entry point
            // https://nodejs.org/api/packages.html#conditional-exports
            addEntryPoint(
              packageName,
              project,
              getPackageTargets(packageExports[entryPoint])
            );
          }
        }
      }
    } else if (packageMain) {
      // if there is no exports, but there is a main, the package name is the
      // entry point
      addEntryPoint(packageName, project, [packageMain]);
    }
  }

  return {
    entryPointsToProjectMap,
    wildcardEntryPointsToProjectMap,
    packageToProjectMap,
    ambiguousEntryPoints,
    entryPointsWithProjectBoundaryCrossings,
  };
}

// adapted from PACKAGE_IMPORTS_EXPORTS_RESOLVE at
// https://nodejs.org/docs/latest-v22.x/api/esm.html#resolution-algorithm-specification
export function matchImportToWildcardEntryPointsToProjectMap<
  T extends ProjectGraphProjectNode | ProjectConfiguration,
>(
  wildcardEntryPointsToProjectMap: Record<string, T>,
  importPath: string
): T | null {
  if (!Object.keys(wildcardEntryPointsToProjectMap).length) {
    return null;
  }

  const entryPoint = Object.keys(wildcardEntryPointsToProjectMap).find(
    (key) => {
      const segments = key.split('*');
      if (segments.length > 2) {
        return false;
      }

      const patternBase = segments[0];
      if (patternBase === importPath) {
        return false;
      }

      if (!importPath.startsWith(patternBase)) {
        return false;
      }

      const patternTrailer = segments[1];
      if (
        patternTrailer?.length > 0 &&
        (!importPath.endsWith(patternTrailer) || importPath.length < key.length)
      ) {
        return false;
      }

      return true;
    }
  );

  return entryPoint ? wildcardEntryPointsToProjectMap[entryPoint] : null;
}
