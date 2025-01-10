import { join } from 'node:path/posix';
import type { ProjectGraphProjectNode } from '../../../config/project-graph';
import type { ProjectConfiguration } from '../../../config/workspace-json-project-json';

export function getPackageEntryPointsToProjectMap<
  T extends ProjectGraphProjectNode | ProjectConfiguration
>(projects: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const project of Object.values(projects)) {
    const metadata =
      'data' in project ? project.data.metadata : project.metadata;

    if (!metadata?.js) {
      continue;
    }

    const { packageName, packageExports } = metadata.js;
    if (
      !packageExports ||
      typeof packageExports === 'string' ||
      !Object.keys(packageExports).length
    ) {
      // no `exports` or it points to a file, which would be the equivalent of
      // an '.' export, in which case the package name is the entry point
      result[packageName] = project;
    } else {
      for (const entryPoint of Object.keys(packageExports)) {
        // if entrypoint begins with '.', it is a relative subpath export
        // otherwise, it is a conditional export
        // https://nodejs.org/api/packages.html#conditional-exports
        if (entryPoint.startsWith('.')) {
          result[join(packageName, entryPoint)] = project;
        } else {
          result[packageName] = project;
        }
      }
      // if there was no '.' entrypoint, ensure the package name is matched with the project
      if (!result[packageName]) {
        result[packageName] = project;
      }
    }
  }

  return result;
}
