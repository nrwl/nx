import {
  ProjectGraph,
  ProjectGraphExternalNode,
  ProjectGraphNode,
  ProjectGraphProjectNode,
} from 'nx/src/shared/project-graph';

const reverseMemo = new Map<ProjectGraph, ProjectGraph>();

/**
 * Returns a new project graph where all the edges are reversed.
 *
 * For instance, if project A depends on B, in the reversed graph
 * B will depend on A.
 */
export function reverse(graph: ProjectGraph): ProjectGraph {
  const resultFromMemo = reverseMemo.get(graph);
  if (resultFromMemo) {
    return resultFromMemo;
  }

  const result = {
    nodes: graph.nodes,
    externalNodes: graph.externalNodes,
    dependencies: {},
  } as ProjectGraph;
  Object.keys(graph.nodes).forEach((n) => (result.dependencies[n] = []));
  // we need to keep external node's reverse dependencies to trace our route back
  if (graph.externalNodes) {
    Object.keys(graph.externalNodes).forEach(
      (n) => (result.dependencies[n] = [])
    );
  }
  Object.values(graph.dependencies).forEach((byProject) => {
    byProject.forEach((dep) => {
      const dependency = result.dependencies[dep.target];
      if (dependency) {
        dependency.push({
          type: dep.type,
          source: dep.target,
          target: dep.source,
        });
      }
    });
  });
  reverseMemo.set(graph, result);
  reverseMemo.set(result, graph);
  return result;
}

export function filterNodes(
  predicate?: (n: ProjectGraphNode) => boolean
): (p: ProjectGraph) => ProjectGraph {
  return (original) => {
    const graph = { nodes: {}, dependencies: {} } as ProjectGraph;
    const added = new Set<string>();
    Object.values(original.nodes).forEach((n) => {
      if (!predicate || predicate(n)) {
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

/**
 * @deprecated will be removed in v14. All projects in ProjectGraph's `nodes` are workspace projects
 */
export function isWorkspaceProject(
  project: ProjectGraphNode
): project is ProjectGraphProjectNode {
  return (
    project.type === 'app' || project.type === 'lib' || project.type === 'e2e'
  );
}

export function isNpmProject(
  project: ProjectGraphNode
): project is ProjectGraphExternalNode {
  return project?.type === 'npm';
}

/**
 * @deprecated will be removed in v14. All projects in ProjectGraph's `nodes` are workspace projects. Use {@link pruneExternalNodes}
 */
export const onlyWorkspaceProjects = filterNodes(isWorkspaceProject);

export const pruneExternalNodes = filterNodes();

export function withDeps(
  original: ProjectGraph,
  subsetNodes: ProjectGraphProjectNode[]
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
      if (original.nodes[n.target]) {
        recurNodes(original.nodes[n.target]);
      }
    });
  }

  function recurEdges(node) {
    if (visitedEdges.indexOf(node.name) > -1) return;
    visitedEdges.push(node.name);

    const ds = original.dependencies[node.name];
    ds.forEach((n) => {
      if (!original.nodes[n.target]) {
        return;
      }
      if (!res.dependencies[n.source]) {
        res.dependencies[n.source] = [];
      }
      res.dependencies[n.source].push(n);
    });

    ds.forEach((n) => {
      if (original.nodes[n.target]) {
        recurEdges(original.nodes[n.target]);
      }
    });
  }
}
