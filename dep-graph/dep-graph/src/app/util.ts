import { ProjectGraphDependency, ProjectGraphNode } from '@nrwl/devkit';

export function removeChildrenFromContainer(container: HTMLElement) {
  Array.from(container.children).forEach((child) =>
    container.removeChild(child)
  );
}

export function trimBackSlash(value: string): string {
  return value.replace(/\/$/, '');
}

export function parseParentDirectoriesFromPilePath(
  path: string,
  workspaceRoot: string
) {
  const root = trimBackSlash(path);

  // split the source root on directory separator
  const split: string[] = root.split('/');

  // check the first part for libs or apps, depending on workspaceLayout
  if (split[0] === trimBackSlash(workspaceRoot)) {
    split.shift();
  }

  // pop off the last element, which should be the lib name
  split.pop();

  return split;
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

export function selectProjectsForFocusedProject(
  projects: ProjectGraphNode[],
  dependencies: Record<string, ProjectGraphDependency[]>,
  focusedProjectName: string,
  searchDepth: number
) {
  return projects
    .map((project) => project.name)
    .filter(
      (projectName) =>
        hasPath(
          dependencies,
          focusedProjectName,
          projectName,
          [],
          1,
          searchDepth
        ) ||
        hasPath(
          dependencies,
          projectName,
          focusedProjectName,
          [],
          1,
          searchDepth
        )
    );
}

export function filterProjectsByText(
  text: string,
  includeInPath: boolean,
  searchDepth: number,
  projects: ProjectGraphNode[],
  dependencies: Record<string, ProjectGraphDependency[]>
) {
  const split = text.split(',').map((splitItem) => splitItem.trim());

  const selectedProjects = new Set<string>();

  projects
    .map((project) => project.name)
    .forEach((project) => {
      const projectMatch =
        split.findIndex((splitItem) => project.includes(splitItem)) > -1;

      if (projectMatch) {
        selectedProjects.add(project);

        if (includeInPath) {
          projects
            .map((project) => project.name)
            .forEach((projectInPath) => {
              if (
                hasPath(
                  dependencies,
                  project,
                  projectInPath,
                  [],
                  1,
                  searchDepth
                ) ||
                hasPath(
                  dependencies,
                  projectInPath,
                  project,
                  [],
                  1,
                  searchDepth
                )
              ) {
                selectedProjects.add(projectInPath);
              }
            });
        }
      }
    });

  return Array.from(selectedProjects);
}
