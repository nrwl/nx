function _findCycle(
  graph: { dependencies: Record<string, string[]> },
  id: string,
  visited: { [taskId: string]: boolean },
  path: string[]
) {
  if (visited[id]) return null;
  visited[id] = true;

  for (const d of graph.dependencies[id]) {
    if (path.includes(d)) return [...path, d];
    const cycle = _findCycle(graph, d, visited, [...path, d]);
    if (cycle) return cycle;
  }
  return null;
}

export function findCycle(graph: {
  dependencies: Record<string, string[]>;
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

function _makeAcyclic(
  graph: { dependencies: Record<string, string[]> },
  id: string,
  visited: { [taskId: string]: boolean },
  path: string[]
) {
  if (visited[id]) return;
  visited[id] = true;

  const deps = graph.dependencies[id];
  for (const d of [...deps]) {
    if (path.includes(d)) {
      deps.splice(deps.indexOf(d), 1);
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
