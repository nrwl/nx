import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';

/**
 * Resolves a dependsOn entry to an Nx task ID (project:target format).
 * Handles both string format ("project:target") and object format
 * ({ target: "name", projects?: ["proj1"] }).
 * For same-project object deps (no projects field), uses the owning project name.
 */
function resolveDepToTaskId(
  dep: string | { target?: string; projects?: string | string[] },
  owningProject: string
): string | null {
  if (typeof dep === 'string') {
    return dep;
  }
  const target = dep?.target;
  if (!target) {
    return null;
  }
  if (dep.projects) {
    const projectList = Array.isArray(dep.projects)
      ? dep.projects
      : [dep.projects];
    // For cross-project deps, use the first project
    return projectList[0] !== 'self'
      ? `${projectList[0]}:${target}`
      : `${owningProject}:${target}`;
  }
  // Same-project dep (no projects field)
  return `${owningProject}:${target}`;
}

/**
 * Returns Gradle CLI arguments to exclude dependent tasks
 * that are not part of the current execution set.
 *
 * For example, if a project defines `dependsOn: ['lint']` for the `test` target,
 * and only `test` is running, this will return: ['lint']
 *
 * @param taskIds - Set of Nx task IDs to process
 * @param nodes - Project graph nodes
 * @param runningTaskIds - Set of task IDs that are currently running (won't be excluded)
 * @param includeDependsOnTasks - Set of Gradle task names that should be included (not excluded)
 *   (typically provider-based dependencies that Gradle must resolve)
 */
export function getExcludeTasks(
  taskIds: Set<string>,
  nodes: Record<string, ProjectGraphProjectNode>,
  runningTaskIds: Set<string> = new Set(),
  includeDependsOnTasks: Set<string> = new Set()
): Set<string> {
  const excludes = new Set<string>();

  for (const taskId of taskIds) {
    const [project, target] = taskId.split(':');
    const allDeps = getAllDependsOn(nodes, project, target);

    for (const depTaskId of allDeps) {
      if (!runningTaskIds.has(depTaskId)) {
        const gradleTaskName = getGradleTaskNameWithNxTaskId(depTaskId, nodes);
        if (gradleTaskName && !includeDependsOnTasks.has(gradleTaskName)) {
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
        const depTaskId = resolveDepToTaskId(dep, currentProjectName);
        if (depTaskId && !allDependsOn.has(depTaskId)) {
          stack.push(depTaskId);
        }
      }
    }
  }
  allDependsOn.delete(`${projectName}:${targetName}`); // Exclude the starting task itself

  return allDependsOn;
}
