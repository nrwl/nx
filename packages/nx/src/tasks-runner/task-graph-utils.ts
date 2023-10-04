import { TaskGraph } from '../config/task-graph';

function _findCycle(
  taskGraph: TaskGraph,
  taskId: string,
  visited: { [taskId: string]: boolean },
  path: string[]
) {
  if (visited[taskId]) return null;
  visited[taskId] = true;

  for (const d of taskGraph.dependencies[taskId]) {
    if (path.includes(d)) return [...path, d];
    const cycle = _findCycle(taskGraph, d, visited, [...path, d]);
    if (cycle) return cycle;
  }
  return null;
}

export function findCycle(taskGraph: TaskGraph): string[] | null {
  const visited = {};
  for (const t of Object.keys(taskGraph.dependencies)) {
    visited[t] = false;
  }

  for (const t of Object.keys(taskGraph.dependencies)) {
    const cycle = _findCycle(taskGraph, t, visited, [t]);
    if (cycle) return cycle;
  }

  return null;
}

function _makeAcyclic(
  taskGraph: TaskGraph,
  taskId: string,
  visited: { [taskId: string]: boolean },
  path: string[]
) {
  if (visited[taskId]) return;
  visited[taskId] = true;

  const deps = taskGraph.dependencies[taskId];
  for (const d of [...deps]) {
    if (path.includes(d)) {
      deps.splice(deps.indexOf(d), 1);
    } else {
      _makeAcyclic(taskGraph, d, visited, [...path, d]);
    }
  }
  return null;
}

export function makeAcyclic(taskGraph: TaskGraph): void {
  const visited = {};
  for (const t of Object.keys(taskGraph.dependencies)) {
    visited[t] = false;
  }
  for (const t of Object.keys(taskGraph.dependencies)) {
    _makeAcyclic(taskGraph, t, visited, [t]);
  }
  taskGraph.roots = Object.keys(taskGraph.dependencies).filter(
    (t) => taskGraph.dependencies[t].length === 0
  );
}
