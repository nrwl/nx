import { join } from 'node:path/posix';
import type { ProjectConfiguration } from '../../../config/workspace-json-project-json';

export function getPackageEntryPointsToProjectMap(
  projects: Record<string, ProjectConfiguration>
): Record<string, ProjectConfiguration> {
  const result: Record<string, ProjectConfiguration> = {};
  for (const project of Object.values(projects)) {
    if (!project.metadata?.js) {
      continue;
    }

    const { packageName, packageExports } = project.metadata.js;
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
