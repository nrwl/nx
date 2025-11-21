import { ProjectGraph } from '../config/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { output } from '../utils/output';

function _findCycle(
  graph: {
    dependencies: Record<string, string[]>;
    continuousDependencies?: Record<string, string[]>;
  },
  id: string,
  visited: { [taskId: string]: boolean },
  path: string[]
): string[] | null {
  if (visited[id]) return null;
  visited[id] = true;

  for (const d of [
    ...graph.dependencies[id],
    ...(graph.continuousDependencies?.[id] ?? []),
  ]) {
    if (path.includes(d)) return [...path, d];
    const cycle = _findCycle(graph, d, visited, [...path, d]);
    if (cycle) return cycle;
  }
  return null;
}

/**
 * This function finds a cycle in the graph.
 * @returns the first cycle found, or null if no cycle is found.
 */
export function findCycle(graph: {
  dependencies: Record<string, string[]>;
  continuousDependencies?: Record<string, string[]>;
}): string[] | null {
  const visited = {};
  for (const t of Object.keys(graph.dependencies)) {
    visited[t] = false;
  }

  for (const t of Object.keys(graph.dependencies)) {
    const cycle = _findCycle(graph, t, visited, [t]);
    if (cycle) return cycle;
  }

  return null;
}

/**
 * This function finds all cycles in the graph.
 * @returns a list of unique task ids in all cycles found, or null if no cycle is found.
 */
export function findCycles(graph: {
  dependencies: Record<string, string[]>;
  continuousDependencies?: Record<string, string[]>;
}): Set<string> | null {
  const visited = {};
  const cycles = new Set<string>();
  for (const t of Object.keys(graph.dependencies)) {
    visited[t] = false;
  }

  for (const t of Object.keys(graph.dependencies)) {
    const cycle = _findCycle(graph, t, visited, [t]);
    if (cycle) {
      cycle.forEach((t) => cycles.add(t));
    }
  }

  return cycles.size ? cycles : null;
}

function _makeAcyclic(
  graph: {
    dependencies: Record<string, string[]>;
    continuousDependencies?: Record<string, string[]>;
  },
  id: string,
  visited: { [taskId: string]: boolean },
  path: string[]
) {
  if (visited[id]) return;
  visited[id] = true;

  const deps = graph.dependencies[id];
  const continuousDeps = graph.continuousDependencies?.[id] ?? [];
  for (const d of [...deps, ...continuousDeps]) {
    if (path.includes(d)) {
      deps.splice(deps.indexOf(d), 1);
      continuousDeps.splice(continuousDeps.indexOf(d), 1);
    } else {
      _makeAcyclic(graph, d, visited, [...path, d]);
    }
  }
  return null;
}

export function makeAcyclic(graph: {
  roots: string[];
  dependencies: Record<string, string[]>;
}): void {
  const visited = {};
  for (const t of Object.keys(graph.dependencies)) {
    visited[t] = false;
  }
  for (const t of Object.keys(graph.dependencies)) {
    _makeAcyclic(graph, t, visited, [t]);
  }
  graph.roots = Object.keys(graph.dependencies).filter(
    (t) => graph.dependencies[t].length === 0
  );
}

export function validateNoAtomizedTasks(
  taskGraph: TaskGraph,
  projectGraph: ProjectGraph
) {
  const getNonAtomizedTargetForTask = (task) =>
    projectGraph.nodes[task.target.project]?.data?.targets?.[task.target.target]
      ?.metadata?.nonAtomizedTarget;

  const atomizedRootTasks = Object.values(taskGraph.tasks).filter(
    (task) => getNonAtomizedTargetForTask(task) !== undefined
  );

  if (atomizedRootTasks.length === 0) {
    return;
  }

  const nonAtomizedTasks = atomizedRootTasks
    .map((t) => `"${getNonAtomizedTargetForTask(t)}"`)
    .filter((item, index, arr) => arr.indexOf(item) === index);

  const moreInfoLines = [
    `Please enable Nx Cloud or use the slower ${nonAtomizedTasks.join(
      ','
    )} task${nonAtomizedTasks.length > 1 ? 's' : ''}.`,
    'Learn more at https://nx.dev/ci/features/split-e2e-tasks#nx-cloud-is-required-to-run-atomized-tasks',
  ];

  if (atomizedRootTasks.length === 1) {
    output.error({
      title: `The ${atomizedRootTasks[0].id} task should only be run with Nx Cloud.`,
      bodyLines: [...moreInfoLines],
    });
  } else {
    output.error({
      title: `The following tasks should only be run with Nx Cloud:`,
      bodyLines: [
        ...atomizedRootTasks.map((task) => `  - ${task.id}`),
        '',
        ...moreInfoLines,
      ],
    });
  }
  process.exit(1);
}

export function assertTaskGraphDoesNotContainInvalidTargets(
  taskGraph: TaskGraph
) {
  const nonParallelTasksThatDependOnContinuousTasks = [];
  const nonParallelContinuousTasksThatAreDependedOn = [];
  for (const task of Object.values(taskGraph.tasks)) {
    if (
      task.parallelism === false &&
      taskGraph.continuousDependencies[task.id].length > 0
    ) {
      nonParallelTasksThatDependOnContinuousTasks.push(task);
    }
    for (const dependency of taskGraph.continuousDependencies[task.id]) {
      if (taskGraph.tasks[dependency].parallelism === false) {
        nonParallelContinuousTasksThatAreDependedOn.push(
          taskGraph.tasks[dependency]
        );
      }
    }
  }

  if (nonParallelTasksThatDependOnContinuousTasks.length > 0) {
    throw new NonParallelTaskDependsOnContinuousTasksError(
      nonParallelTasksThatDependOnContinuousTasks,
      taskGraph
    );
  }
  if (nonParallelContinuousTasksThatAreDependedOn.length > 0) {
    throw new DependingOnNonParallelContinuousTaskError(
      nonParallelContinuousTasksThatAreDependedOn,
      taskGraph
    );
  }
}

class NonParallelTaskDependsOnContinuousTasksError extends Error {
  constructor(public invalidTasks: Task[], taskGraph: TaskGraph) {
    let message =
      'The following tasks do not support parallelism but depend on continuous tasks:';

    for (const task of invalidTasks) {
      message += `\n - ${task.id} -> ${taskGraph.continuousDependencies[
        task.id
      ].join(', ')}`;
    }

    super(message);
    this.name = 'NonParallelTaskDependsOnContinuousTasksError';
  }
}

class DependingOnNonParallelContinuousTaskError extends Error {
  constructor(public invalidTasks: Task[], taskGraph: TaskGraph) {
    let message =
      'The following continuous tasks do not support parallelism but are depended on:';

    for (const task of invalidTasks) {
      const dependents = Object.keys(taskGraph.continuousDependencies).filter(
        (parentTaskId) =>
          taskGraph.continuousDependencies[parentTaskId].includes(task.id)
      );

      message += `\n - ${task.id} <- ${dependents.join(', ')}`;
    }

    message +=
      '\nParallelism must be enabled for a continuous task if it is depended on, as the tasks that depend on it will run in parallel with it.';

    super(message);
    this.name = 'DependingOnNonParallelContinuousTaskError';
  }
}

export function getLeafTasks(taskGraph: TaskGraph): Set<string> {
  const reversed = reverseTaskGraph(taskGraph);
  const leafTasks = new Set<string>();
  for (const [taskId, dependencies] of Object.entries(reversed.dependencies)) {
    if (dependencies.length === 0) {
      leafTasks.add(taskId);
    }
  }

  return leafTasks;
}

function reverseTaskGraph(taskGraph: TaskGraph): TaskGraph {
  const reversed = {
    tasks: taskGraph.tasks,
    dependencies: Object.fromEntries(
      Object.entries(taskGraph.tasks).map(([taskId]) => [taskId, []])
    ),
  } as TaskGraph;
  for (const [taskId, dependencies] of Object.entries(taskGraph.dependencies)) {
    for (const dependency of dependencies) {
      reversed.dependencies[dependency].push(taskId);
    }
  }
  for (const [taskId, dependencies] of Object.entries(
    taskGraph.continuousDependencies
  )) {
    for (const dependency of dependencies) {
      reversed.dependencies[dependency].push(taskId);
    }
  }
  return reversed;
}
