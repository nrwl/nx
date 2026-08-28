import { TaskGraph } from '../config/task-graph';

/**
 * Narrows a task graph to the selected tasks plus everything they depend on.
 *
 * The dependency closure has to survive: an affected task's upstream tasks still
 * have to run or be restored from cache even when they are not themselves
 * affected. Ids that are not in the graph are dropped rather than throwing —
 * sync generators can remove a task between the selection and the rebuild.
 */
export function pruneTaskGraphToSelection(
  taskGraph: TaskGraph,
  selectedTaskIds: Iterable<string>
): TaskGraph {
  const keep = new Set<string>();
  const stack: string[] = [];
  for (const id of selectedTaskIds) {
    if (taskGraph.tasks[id] && !keep.has(id)) {
      keep.add(id);
      stack.push(id);
    }
  }
  while (stack.length) {
    const id = stack.pop()!;
    const deps = [
      ...(taskGraph.dependencies[id] ?? []),
      ...(taskGraph.continuousDependencies?.[id] ?? []),
    ];
    for (const dep of deps) {
      if (taskGraph.tasks[dep] && !keep.has(dep)) {
        keep.add(dep);
        stack.push(dep);
      }
    }
  }

  const tasks: TaskGraph['tasks'] = {};
  const dependencies: TaskGraph['dependencies'] = {};
  const continuousDependencies: TaskGraph['continuousDependencies'] = {};
  for (const id of keep) {
    tasks[id] = taskGraph.tasks[id];
    dependencies[id] = (taskGraph.dependencies[id] ?? []).filter((d) =>
      keep.has(d)
    );
    continuousDependencies[id] = (
      taskGraph.continuousDependencies?.[id] ?? []
    ).filter((d) => keep.has(d));
  }

  return {
    // Recomputed rather than intersected with the old roots: the two agree only
    // because the kept set is closed downwards, and asserting that here would
    // be cheaper to get wrong than to recompute.
    roots: Object.keys(tasks).filter(
      (id) => !dependencies[id].length && !continuousDependencies[id].length
    ),
    tasks,
    dependencies,
    continuousDependencies,
  };
}
