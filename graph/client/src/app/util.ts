/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphDependency } from '@nx/devkit';
import type {
  FileDataDependency,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';
/* eslint-enable @nx/enforce-module-boundaries */

import type { ProjectUINode, CompositeProjectUINode } from '@nx/graph/projects';

// New interfaces for updated ProjectList
export interface SidebarProjectUINode {
  projectUINode: ProjectUINode;
  isSelected: boolean;
}

export interface SidebarCompositeUINode {
  compositeUINode: CompositeProjectUINode;
  isSelected: boolean;
}

export type DirectoryProjectUIRecord = Record<string, SidebarProjectUINode[]>;

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

export function getProjectUINodesByType(
  type: string,
  projectUINodes: ProjectUINode[]
): ProjectUINode[] {
  return projectUINodes
    .filter((node) => node.metadata.projectType === type)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function groupProjectUINodesByDirectory(
  projectUINodes: ProjectUINode[],
  selectedProjects: string[],
  workspaceLayout: { appsDir: string; libsDir: string }
): DirectoryProjectUIRecord {
  let groups: DirectoryProjectUIRecord = {};

  for (const projectUINode of projectUINodes) {
    const workspaceRoot =
      projectUINode.metadata.projectType === 'app' ||
      projectUINode.metadata.projectType === 'e2e'
        ? workspaceLayout.appsDir
        : workspaceLayout.libsDir;

    const directories = parseParentDirectoriesFromFilePath(
      projectUINode.metadata.root,
      workspaceRoot
    );

    const directory = directories.join('/');

    if (!groups.hasOwnProperty(directory)) {
      groups[directory] = [];
    }

    groups[directory].push({
      projectUINode,
      isSelected: selectedProjects.includes(projectUINode.name),
    });
  }

  return groups;
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
    return `task-${project}:${target}:${configuration}`;
  } else {
    return `task-${project}:${target}`;
  }
}

export function extractDependencyTarget(dependency: FileDataDependency) {
  if (typeof dependency === 'string') return dependency;
  if (dependency.length === 2) return dependency[0];
  return dependency[1];
}
