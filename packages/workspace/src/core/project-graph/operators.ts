import { ProjectGraph, ProjectGraphNode } from '@nrwl/devkit';

const reverseMemo = new Map<ProjectGraph, ProjectGraph>();

export function reverse(graph: ProjectGraph): ProjectGraph {
  const resultFromMemo = reverseMemo.get(graph);
  if (resultFromMemo) return resultFromMemo;

  const result = { nodes: graph.nodes, dependencies: {} } as ProjectGraph;
  Object.keys(graph.nodes).forEach((n) => (result.dependencies[n] = []));
  Object.values(graph.dependencies).forEach((byProject) => {
    byProject.forEach((dep) => {
      result.dependencies[dep.target].push({
        type: dep.type,
        source: dep.target,
        target: dep.source,
      });
    });
  });
  reverseMemo.set(graph, result);
  reverseMemo.set(result, graph);
  return result;
}

export function filterNodes(
  predicate: (n: ProjectGraphNode) => boolean
): (p: ProjectGraph) => ProjectGraph {
  return (original) => {
    const graph = { nodes: {}, dependencies: {} } as ProjectGraph;
    const added = new Set<string>();
    Object.values(original.nodes).forEach((n) => {
      if (predicate(n)) {
        graph.nodes[n.name] = n;
        graph.dependencies[n.name] = [];
        added.add(n.name);
      }
    });
    Object.values(original.dependencies).forEach((ds) => {
      ds.forEach((d) => {
        if (added.has(d.source) && added.has(d.target)) {
          graph.dependencies[d.source].push(d);
        }
      });
    });
    return graph;
  };
}

export function isWorkspaceProject(project: ProjectGraphNode) {
  return (
    project.type === 'app' || project.type === 'lib' || project.type === 'e2e'
  );
}

export function isNpmProject(
  project: ProjectGraphNode
): project is ProjectGraphNode<{ packageName: string; version: string }> {
  return project.type === 'npm';
}

export function getSortedProjectNodes(nodes: Record<string, ProjectGraphNode>) {
  return Object.values(nodes).sort((nodeA, nodeB) => {
    // If a or b is not a nx project, leave them in the same spot
    if (!isWorkspaceProject(nodeA) && !isWorkspaceProject(nodeB)) {
      return 0;
    }
    // sort all non-projects lower
    if (!isWorkspaceProject(nodeA) && isWorkspaceProject(nodeB)) {
      return 1;
    }
    if (isWorkspaceProject(nodeA) && !isWorkspaceProject(nodeB)) {
      return -1;
    }

    return nodeA.data.root.length > nodeB.data.root.length ? -1 : 1;
  });
}

export const onlyWorkspaceProjects = filterNodes(isWorkspaceProject);

export function withDeps(
  original: ProjectGraph,
  subsetNodes: ProjectGraphNode[]
): ProjectGraph {
  const res = { nodes: {}, dependencies: {} } as ProjectGraph;
  const visitedNodes = [];
  const visitedEdges = [];
  Object.values(subsetNodes).forEach(recurNodes);
  Object.values(subsetNodes).forEach(recurEdges);
  return res;

  // ---------------------------------------------------------------------------

  function recurNodes(node) {
    if (visitedNodes.indexOf(node.name) > -1) return;
    res.nodes[node.name] = node;
    if (!res.dependencies[node.name]) {
      res.dependencies[node.name] = [];
    }
    visitedNodes.push(node.name);

    original.dependencies[node.name].forEach((n) => {
      recurNodes(original.nodes[n.target]);
    });
  }

  function recurEdges(node) {
    if (visitedEdges.indexOf(node.name) > -1) return;
    visitedEdges.push(node.name);

    const ds = original.dependencies[node.name];
    ds.forEach((n) => {
      if (!res.dependencies[n.source]) {
        res.dependencies[n.source] = [];
      }
      res.dependencies[n.source].push(n);
    });

    ds.forEach((n) => {
      recurEdges(original.nodes[n.target]);
    });
  }
}
