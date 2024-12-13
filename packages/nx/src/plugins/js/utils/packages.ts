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
    if (!packageExports || typeof packageExports === 'string') {
      // no `exports` or it points to a file, which would be the equivalent of
      // an '.' export, in which case the package name is the entry point
      result[packageName] = project;
    } else {
      for (const entryPoint of Object.keys(packageExports)) {
        result[join(packageName, entryPoint)] = project;
      }
    }
  }

  return result;
}
