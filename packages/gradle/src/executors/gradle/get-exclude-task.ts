import { ProjectGraphProjectNode, Target, TaskGraph } from '@nx/devkit';

function getGradleTaskName(
  target: Target,
  nodes: Record<string, ProjectGraphProjectNode>
): string | null {
  return nodes[target.project]?.data?.targets?.[target.target]?.options
    ?.taskName;
}

export function getExcludeTasksFromTaskGraph(
  taskIdsToExcludeDepsOf: Iterable<string>,
  runningTaskIds: Set<string>,
  taskGraph: TaskGraph,
  nodes: Record<string, ProjectGraphProjectNode>,
  includeDependsOnTasks: Set<string> = new Set()
): Set<string> {
  const excludes = new Set<string>();
  const transitiveDepIds = getAllDependsOnFromTaskGraph(
    taskIdsToExcludeDepsOf,
    taskGraph
  );

  for (const depTaskId of transitiveDepIds) {
    if (runningTaskIds.has(depTaskId)) {
      continue;
    }
    const task = taskGraph.tasks[depTaskId];
    if (!task) {
      continue;
    }
    const gradleTaskName = getGradleTaskName(task.target, nodes);
    if (gradleTaskName && !includeDependsOnTasks.has(gradleTaskName)) {
      excludes.add(gradleTaskName);
    }
  }

  return excludes;
}

export function getAllDependsOnFromTaskGraph(
  startTaskIds: Iterable<string>,
  taskGraph: TaskGraph
): Set<string> {
  const result = new Set<string>();
  const seen = new Set<string>();
  const stack: string[] = [];

  const edges = (id: string): string[] => [
    ...(taskGraph.dependencies[id] ?? []),
    ...(taskGraph.continuousDependencies?.[id] ?? []),
  ];

  for (const id of startTaskIds) {
    seen.add(id);
    for (const dep of edges(id)) {
      stack.push(dep);
    }
  }

  while (stack.length > 0) {
    const current = stack.pop();
    if (seen.has(current)) {
      continue;
    }
    seen.add(current);
    result.add(current);

    for (const dep of edges(current)) {
      if (!seen.has(dep)) {
        stack.push(dep);
      }
    }
  }

  return result;
}
