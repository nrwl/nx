import { ProjectGraphBuilder } from './project-graph-builder';
import {
  ProjectGraph,
  ProjectGraphNode,
  ProjectGraphNodeRecords,
} from './project-graph-models';

const reverseMemo = new Map<ProjectGraph, ProjectGraph>();

export function reverse(graph: ProjectGraph): ProjectGraph {
  let result = reverseMemo.get(graph);
  if (!result) {
    const builder = new ProjectGraphBuilder();
    Object.values(graph.nodes).forEach((n) => {
      builder.addNode(n);
    });
    Object.values(graph.dependencies).forEach((byProject) => {
      byProject.forEach((dep) => {
        builder.addDependency(dep.type, dep.target, dep.source);
      });
    });
    result = builder.build();
    reverseMemo.set(graph, result);
    reverseMemo.set(result, graph);
  }
  return result;
}

export function filterNodes(
  predicate: (n: ProjectGraphNode) => boolean
): (p: ProjectGraph) => ProjectGraph {
  return (original) => {
    const builder = new ProjectGraphBuilder();
    const added = new Set<string>();
    Object.values(original.nodes).forEach((n) => {
      if (predicate(n)) {
        builder.addNode(n);
        added.add(n.name);
      }
    });
    Object.values(original.dependencies).forEach((ds) => {
      ds.forEach((d) => {
        if (added.has(d.source) && added.has(d.target)) {
          builder.addDependency(d.type, d.source, d.target);
        }
      });
    });
    return builder.build();
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

export function getSortedProjectNodes(nodes: ProjectGraphNodeRecords) {
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
  const builder = new ProjectGraphBuilder();
  const visitedNodes = [];
  const visitedEdges = [];
  Object.values(subsetNodes).forEach(recurNodes);
  Object.values(subsetNodes).forEach(recurEdges);
  return builder.build();

  // ---------------------------------------------------------------------------

  function recurNodes(node) {
    if (visitedNodes.indexOf(node.name) > -1) return;
    builder.addNode(node);
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
      builder.addDependency(n.type, n.source, n.target);
    });

    ds.forEach((n) => {
      recurEdges(original.nodes[n.target]);
    });
  }
}
