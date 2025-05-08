import { ProjectGraph } from 'nx/src/config/project-graph';

/**
 * Returns Gradle CLI arguments to exclude dependent tasks
 * that are not part of the current execution set.
 *
 * For example, if a project defines `dependsOn: ['lint']` for the `test` target,
 * and only `test` is running, this will return: ['--exclude-task', 'lint'].
 */
export function getExcludeTasksArgs(
  projectGraph: ProjectGraph,
  targets: { project: string; target: string; excludeDependsOn: boolean }[],
  runningTaskIds: string[] = []
): string[] {
  const excludes = new Set<string>();

  for (const { project, target, excludeDependsOn } of targets) {
    if (!excludeDependsOn) {
      continue;
    }
    const taskDeps =
      projectGraph.nodes[project]?.data?.targets?.[target]?.dependsOn ?? [];

    for (const dep of taskDeps) {
      const taskId = typeof dep === 'string' ? dep : dep?.target;
      if (taskId && !runningTaskIds.includes(taskId)) {
        excludes.add(taskId);
      }
    }
  }

  const args: string[] = [];

  for (const taskId of excludes) {
    const [projectName, targetName] = taskId.split(':');
    const taskName =
      projectGraph.nodes[projectName]?.data?.targets?.[targetName]?.options
        ?.taskName;
    if (taskName) {
      args.push('--exclude-task', taskName);
    }
  }

  return args;
}
