import { dirname, relative, resolve } from 'node:path';
import { ProjectConfiguration, normalizePath } from '@nx/devkit';

export function createProjectRootMappings(
  projects: Record<string, ProjectConfiguration>
): Record<string, string> {
  const rootMap: Record<string, string> = {};
  for (const [, project] of Object.entries(projects)) {
    if (project.root && project.name) {
      rootMap[project.root] = project.name;
    }
  }
  return rootMap;
}

export function findProjectForPath(
  filePath: string,
  rootMap: Record<string, string>
): string | undefined {
  let currentPath = normalizePath(filePath);

  for (
    ;
    currentPath !== dirname(currentPath);
    currentPath = dirname(currentPath)
  ) {
    const project = rootMap[currentPath];
    if (project) {
      return project;
    }
  }

  return rootMap[currentPath];
}

export function resolveReferenceToProject(
  reference: string,
  sourceFile: string,
  rootMap: Record<string, string>,
  workspaceRoot: string
): string | undefined {
  const resolved = resolve(workspaceRoot, dirname(sourceFile), reference);
  const relativePath = relative(workspaceRoot, resolved);
  return findProjectForPath(relativePath, rootMap);
}
