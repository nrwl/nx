import { ProjectGraphProjectNode } from 'nx/src/config/project-graph';

export interface ProjectTarget {
  project: string;
  target: string;
}

function projectTargetKey(pt: ProjectTarget): string {
  return `${pt.project}:${pt.target}`;
}

/**
 * Resolves a dependsOn entry to a ProjectTarget.
 * Handles both string format ("target") and object format
 * ({ target: "name", projects?: ["proj1"] }).
 * For same-project object deps (no projects field), uses the owning project name.
 */
function resolveDepToProjectTarget(
  dep: string | { target?: string; projects?: string | string[] },
  owningProject: string
): ProjectTarget | null {
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
 * @param tasks - Set of ProjectTarget to process
 * @param nodes - Project graph nodes
 * @param runningTasks - Set of ProjectTarget that are currently running (won't be excluded)
 * @param includeDependsOnTasks - Set of Gradle task names that should be included (not excluded)
 *   (typically provider-based dependencies that Gradle must resolve)
 */
export function getExcludeTasks(
  tasks: Set<ProjectTarget>,
  nodes: Record<string, ProjectGraphProjectNode>,
  runningTasks: Set<ProjectTarget> = new Set(),
  includeDependsOnTasks: Set<string> = new Set()
): Set<string> {
  const excludes = new Set<string>();
  const runningKeys = new Set(
    Array.from(runningTasks).map(projectTargetKey)
  );

  for (const task of tasks) {
    const taskDeps =
      nodes[task.project]?.data?.targets?.[task.target]?.dependsOn ?? [];

    for (const dep of taskDeps) {
      const depPt = resolveDepToProjectTarget(dep, task.project);
      if (depPt && !runningKeys.has(projectTargetKey(depPt))) {
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
  pt: ProjectTarget,
  nodes: Record<string, ProjectGraphProjectNode>
): string | null {
  return nodes[pt.project]?.data?.targets?.[pt.target]?.options?.taskName;
}


export function getAllDependsOn(
  nodes: Record<string, ProjectGraphProjectNode>,
  projectName: string,
  targetName: string
): Set<ProjectTarget> {
  const allDependsOn = new Set<string>();
  const result = new Set<ProjectTarget>();
  const startKey = projectTargetKey({ project: projectName, target: targetName });
  const stack: ProjectTarget[] = [{ project: projectName, target: targetName }];

  while (stack.length > 0) {
    const current = stack.pop();
    const key = projectTargetKey(current);
    if (!allDependsOn.has(key)) {
      allDependsOn.add(key);
      if (key !== startKey) {
        result.add(current);
      }

      const directDependencies =
        nodes[current.project]?.data?.targets?.[current.target]?.dependsOn ??
        [];

      for (const dep of directDependencies) {
        const depPt = resolveDepToProjectTarget(dep, current.project);
        if (depPt && !allDependsOn.has(projectTargetKey(depPt))) {
          stack.push(depPt);
        }
      }
    }
  }

  return result;
}