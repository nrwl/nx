/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import { ProjectGraphDependency, ProjectGraphProjectNode } from '@nx/devkit';
/* eslint-enable @nx/enforce-module-boundaries */
import { getEnvironmentConfig } from './hooks/use-environment-config';
import { To, useParams, useSearchParams } from 'react-router-dom';

export const useRouteConstructor = (): ((
  to: To,
  retainSearchParams: boolean
) => To) => {
  const { environment } = getEnvironmentConfig();
  const { selectedWorkspaceId } = useParams();
  const [searchParams] = useSearchParams();

  return (to: To, retainSearchParams: true) => {
    let pathname = '';

    if (typeof to === 'object') {
      if (environment === 'dev') {
        pathname = `/${selectedWorkspaceId}${to.pathname}`;
      } else {
        pathname = to.pathname;
      }
      return {
        ...to,
        pathname,
        search: to.search
          ? to.search.toString()
          : retainSearchParams
          ? searchParams.toString()
          : '',
      };
    } else if (typeof to === 'string') {
      if (environment === 'dev') {
        pathname = `/${selectedWorkspaceId}${to}`;
      } else {
        pathname = to;
      }
      return {
        pathname,
        search: retainSearchParams ? searchParams.toString() : '',
      };
    }
  };
};

export function parseParentDirectoriesFromFilePath(
  path: string,
  workspaceRoot: string
) {
  const directories = path
    .replace(workspaceRoot, '')
    .split('/')
    .filter((directory) => directory !== '');
  // last directory is the project
  directories.pop();
  return directories;
}

export function hasPath(
  dependencies: Record<string, ProjectGraphDependency[]>,
  target: string,
  node: string,
  visited: string[],
  currentSearchDepth: number,
  maxSearchDepth: number = -1 // -1 indicates unlimited search depth
) {
  if (target === node) return true;

  if (maxSearchDepth === -1 || currentSearchDepth <= maxSearchDepth) {
    for (let d of dependencies[node] || []) {
      if (visited.indexOf(d.target) > -1) continue;
      visited.push(d.target);
      if (
        hasPath(
          dependencies,
          target,
          d.target,
          visited,
          currentSearchDepth + 1,
          maxSearchDepth
        )
      )
        return true;
    }
  }

  return false;
}

export function getProjectsByType(
  type: string,
  projects: ProjectGraphProjectNode[]
): ProjectGraphProjectNode[] {
  return projects
    .filter((project) => project.type === type)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function groupProjectsByDirectory(
  projects: ProjectGraphProjectNode[],
  workspaceLayout: { appsDir: string; libsDir: string }
): Record<string, ProjectGraphProjectNode[]> {
  let groups: Record<string, ProjectGraphProjectNode[]> = {};

  projects.forEach((project) => {
    const workspaceRoot =
      project.type === 'app' || project.type === 'e2e'
        ? workspaceLayout.appsDir
        : workspaceLayout.libsDir;
    const directories = parseParentDirectoriesFromFilePath(
      (project.data as any).root,
      workspaceRoot
    );

    const directory = directories.join('/');

    if (!groups.hasOwnProperty(directory)) {
      groups[directory] = [];
    }
    groups[directory].push(project);
  });

  return groups;
}

export function createTaskName(
  project: string,
  target: string,
  configuration?: string
) {
  if (configuration) {
    return `${project}:${target}:${configuration}`;
  } else {
    return `${project}:${target}`;
  }
}
