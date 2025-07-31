import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';

/**
 * Returns Gradle CLI arguments to exclude dependent tasks
 * that are not part of the current execution set.
 *
 * For example, if a project defines `dependsOn: ['lint']` for the `test` target,
 * and only `test` is running, this will return: ['lint']
 */
export function getExcludeTasks(
  taskIds: Set<string>,
  nodes: Record<string, ProjectGraphProjectNode>,
  runningTaskIds: Set<string> = new Set()
): Set<string> {
  const excludes = new Set<string>();

  for (const taskId of taskIds) {
    const [project, target] = taskId.split(':');
    const taskDeps = nodes[project]?.data?.targets?.[target]?.dependsOn ?? [];

    for (const dep of taskDeps) {
      const taskId = typeof dep === 'string' ? dep : dep?.target;
      if (taskId && !runningTaskIds.has(taskId)) {
        const gradleTaskName = getGradleTaskNameWithNxTaskId(taskId, nodes);
        if (gradleTaskName) {
          excludes.add(gradleTaskName);
        }
      }
    }
  }

  return excludes;
}

export function getGradleTaskNameWithNxTaskId(
  nxTaskId: string,
  nodes: Record<string, ProjectGraphProjectNode>
): string | null {
  const [projectName, targetName] = nxTaskId.split(':');
  const gradleTaskName =
    nodes[projectName]?.data?.targets?.[targetName]?.options?.taskName;
  return gradleTaskName;
}

export function getAllDependsOn(
  nodes: Record<string, ProjectGraphProjectNode>,
  projectName: string,
  targetName: string
): Set<string> {
  const allDependsOn = new Set<string>();
  const stack: string[] = [`${projectName}:${targetName}`];

  while (stack.length > 0) {
    const currentTaskId = stack.pop();
    if (currentTaskId && !allDependsOn.has(currentTaskId)) {
      allDependsOn.add(currentTaskId);

      const [currentProjectName, currentTargetName] = currentTaskId.split(':');
      const directDependencies =
        nodes[currentProjectName]?.data?.targets?.[currentTargetName]
          ?.dependsOn ?? [];

      for (const dep of directDependencies) {
        const depTaskId = typeof dep === 'string' ? dep : dep?.target;
        if (depTaskId && !allDependsOn.has(depTaskId)) {
          stack.push(depTaskId);
        }
      }
    }
  }
  allDependsOn.delete(`${projectName}:${targetName}`); // Exclude the starting task itself

  return allDependsOn;
}
