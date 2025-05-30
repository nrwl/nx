import { ProjectGraph } from 'nx/src/config/project-graph';

/**
 * Returns Gradle CLI arguments to exclude dependent tasks
 * that are not part of the current execution set.
 *
 * For example, if a project defines `dependsOn: ['lint']` for the `test` target,
 * and only `test` is running, this will return: ['lint']
 */
export function getExcludeTasks(
  projectGraph: ProjectGraph,
  targets: { project: string; target: string; excludeDependsOn: boolean }[],
  runningTaskIds: Set<string> = new Set()
): Set<string> {
  const excludes = new Set<string>();

  for (const { project, target, excludeDependsOn } of targets) {
    if (!excludeDependsOn) {
      continue;
    }
    const taskDeps =
      projectGraph.nodes[project]?.data?.targets?.[target]?.dependsOn ?? [];

    for (const dep of taskDeps) {
      const taskId = typeof dep === 'string' ? dep : dep?.target;
      if (taskId && !runningTaskIds.has(taskId)) {
        const [projectName, targetName] = taskId.split(':');
        const taskName =
          projectGraph.nodes[projectName]?.data?.targets?.[targetName]?.options
            ?.taskName;
        if (taskName) {
          excludes.add(taskName);
        }
      }
    }
  }

  return excludes;
}

export function getAllDependsOn(
  projectGraph: ProjectGraph,
  projectName: string,
  targetName: string,
  visited: Set<string> = new Set()
): string[] {
  const dependsOn =
    projectGraph[projectName]?.data?.targets?.[targetName]?.dependsOn ?? [];

  const allDependsOn: string[] = [];

  for (const dependency of dependsOn) {
    if (!visited.has(dependency)) {
      visited.add(dependency);

      const [depProjectName, depTargetName] = dependency.split(':');
      allDependsOn.push(dependency);

      // Recursively get dependencies of the current dependency
      allDependsOn.push(
        ...getAllDependsOn(projectGraph, depProjectName, depTargetName, visited)
      );
    }
  }

  return allDependsOn;
}
