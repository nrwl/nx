import {
  ProjectGraphProjectNode,
  Target,
  targetToTargetString,
} from '@nx/devkit';

/**
 * Resolves a dependsOn entry to a Target.
 * Handles both string format ("target") and object format
 * ({ target: "name", projects?: ["proj1"] }).
 * For same-project object deps (no projects field), uses the owning project name.
 */
function resolveDepToTarget(
  dep: string | { target?: string; projects?: string | string[] },
  owningProject: string
): Target | null {
  if (typeof dep === 'string') {
    return { project: owningProject, target: dep };
  }
  const target = dep?.target;
  if (!target) {
    return null;
  }
  if (dep.projects) {
    const projectList = Array.isArray(dep.projects)
      ? dep.projects
      : [dep.projects];
    return {
      project: projectList[0] !== 'self' ? projectList[0] : owningProject,
      target,
    };
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
 * @param tasks - Set of Target to process
 * @param nodes - Project graph nodes
 * @param runningTasks - Set of Target that are currently running (won't be excluded)
 * @param includeDependsOnTasks - Set of Gradle task names that should be included (not excluded)
 *   (typically provider-based dependencies that Gradle must resolve)
 */
export function getExcludeTasks(
  tasks: Set<Target>,
  nodes: Record<string, ProjectGraphProjectNode>,
  runningTasks: Set<Target> = new Set(),
  includeDependsOnTasks: Set<string> = new Set()
): Set<string> {
  const excludes = new Set<string>();
  const runningKeys = new Set(
    Array.from(runningTasks).map(targetToTargetString)
  );

  for (const task of tasks) {
    const taskDeps =
      nodes[task.project]?.data?.targets?.[task.target]?.dependsOn ?? [];

    for (const dep of taskDeps) {
      const depPt = resolveDepToTarget(dep, task.project);
      if (depPt && !runningKeys.has(targetToTargetString(depPt))) {
        const gradleTaskName = getGradleTaskName(depPt, nodes);
        if (gradleTaskName && !includeDependsOnTasks.has(gradleTaskName)) {
          excludes.add(gradleTaskName);
        }
      }
    }
  }

  return excludes;
}

export function getGradleTaskName(
  pt: Target,
  nodes: Record<string, ProjectGraphProjectNode>
): string | null {
  return nodes[pt.project]?.data?.targets?.[pt.target]?.options?.taskName;
}

export function getAllDependsOn(
  nodes: Record<string, ProjectGraphProjectNode>,
  projectName: string,
  targetName: string
): Set<Target> {
  const allDependsOn = new Set<string>();
  const result = new Set<Target>();
  const startKey = targetToTargetString({
    project: projectName,
    target: targetName,
  });
  const stack: Target[] = [{ project: projectName, target: targetName }];

  while (stack.length > 0) {
    const current = stack.pop();
    const key = targetToTargetString(current);
    if (!allDependsOn.has(key)) {
      allDependsOn.add(key);
      if (key !== startKey) {
        result.add(current);
      }

      const directDependencies =
        nodes[current.project]?.data?.targets?.[current.target]?.dependsOn ??
        [];

      for (const dep of directDependencies) {
        const depPt = resolveDepToTarget(dep, current.project);
        if (depPt && !allDependsOn.has(targetToTargetString(depPt))) {
          stack.push(depPt);
        }
      }
    }
  }

  return result;
}
