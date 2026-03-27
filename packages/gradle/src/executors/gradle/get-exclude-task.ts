import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from 'nx/src/config/project-graph';

interface NxTaskId {
  project: string;
  target: string;
}

export function parseNxTaskId(taskIdString: string): NxTaskId {
  const colonIndex = taskIdString.indexOf(':');
  return {
    project: taskIdString.substring(0, colonIndex),
    target: taskIdString.substring(colonIndex + 1),
  };
}

function toNxTaskIdString(taskId: NxTaskId): string {
  return `${taskId.project}:${taskId.target}`;
}

/**
 * Resolves a dependsOn entry to a structured Nx task ID.
 * Handles both string format ("project:target") and object format
 * ({ target: "name", projects?: ["proj1"] }).
 * For same-project object deps (no projects field), uses the owning project name.
 */
function resolveDepToTaskId(
  dep: string | { target?: string; projects?: string | string[] },
  owningProject: string
): NxTaskId | null {
  if (typeof dep === 'string') {
    return parseNxTaskId(dep);
  }
  const target = dep?.target;
  if (!target) {
    return null;
  }
  if (dep.projects) {
    const projectList = Array.isArray(dep.projects)
      ? dep.projects
      : [dep.projects];
    const project = projectList[0] !== 'self' ? projectList[0] : owningProject;
    return { project, target };
  }
  return { project: owningProject, target };
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
 * @param includeDependsOnTasks - Tasks that should be included (not excluded)
 *   (typically provider-based dependencies that Gradle must resolve)
 */
export function getExcludeTasks(
  taskIds: Set<string>,
  nodes: Record<string, ProjectGraphProjectNode>,
  runningTaskIds: Set<string> = new Set(),
  includeDependsOnTasks: Array<{
    target: string;
    projects: string | string[];
  }> = []
): Set<string> {
  const excludes = new Set<string>();

  const includedGradleTaskNames = new Set<string>();
  for (const entry of includeDependsOnTasks) {
    const projects = Array.isArray(entry.projects)
      ? entry.projects
      : [entry.projects];
    for (const project of projects) {
      const gradleTaskName = getGradleTaskNameWithNxTaskId(
        { project, target: entry.target },
        nodes
      );
      if (gradleTaskName) {
        includedGradleTaskNames.add(gradleTaskName);
      }
    }
  }

  for (const taskId of taskIds) {
    const { project, target } = parseNxTaskId(taskId);
    const taskDeps = nodes[project]?.data?.targets?.[target]?.dependsOn ?? [];

    for (const dep of taskDeps) {
      const depTaskId = resolveDepToTaskId(dep, project);
      if (depTaskId && !runningTaskIds.has(toNxTaskIdString(depTaskId))) {
        const gradleTaskName = getGradleTaskNameWithNxTaskId(depTaskId, nodes);
        if (gradleTaskName && !includedGradleTaskNames.has(gradleTaskName)) {
          excludes.add(gradleTaskName);
        }
      }
    }
  }

  return excludes;
}

export function getGradleTaskNameWithNxTaskId(
  taskId: NxTaskId,
  nodes: Record<string, ProjectGraphProjectNode>
): string | null {
  const gradleTaskName =
    nodes[taskId.project]?.data?.targets?.[taskId.target]?.options?.taskName;
  return gradleTaskName;
}

export function getAllDependsOn(
  nodes: Record<string, ProjectGraphProjectNode>,
  projectName: string,
  targetName: string
): Set<string> {
  const visited = new Set<string>();
  const startId = toNxTaskIdString({
    project: projectName,
    target: targetName,
  });
  const stack: NxTaskId[] = [{ project: projectName, target: targetName }];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const currentKey = toNxTaskIdString(current);
    if (!visited.has(currentKey)) {
      visited.add(currentKey);

      const directDependencies =
        nodes[current.project]?.data?.targets?.[current.target]?.dependsOn ??
        [];

      for (const dep of directDependencies) {
        const depTaskId = resolveDepToTaskId(dep, current.project);
        if (depTaskId && !visited.has(toNxTaskIdString(depTaskId))) {
          stack.push(depTaskId);
        }
      }
    }
  }
  visited.delete(startId);

  return visited;
}
