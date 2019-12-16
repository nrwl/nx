import { ProjectGraphBuilder } from './project-graph-builder';
import { ProjectGraph, ProjectGraphNode } from './project-graph-models';

const reverseMemo = new Map<ProjectGraph, ProjectGraph>();
export function reverse(graph: ProjectGraph): ProjectGraph {
  let result = reverseMemo.get(graph);
  if (!result) {
    const builder = new ProjectGraphBuilder();
    Object.values(graph.nodes).forEach(n => {
      builder.addNode(n);
    });
    Object.values(graph.dependencies).forEach(byProject => {
      byProject.forEach(dep => {
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
  return original => {
    const builder = new ProjectGraphBuilder();
    const added = new Set<string>();
    Object.values(original.nodes).forEach(n => {
      if (predicate(n)) {
        builder.addNode(n);
        added.add(n.name);
      }
    });
    Object.values(original.dependencies).forEach(ds => {
      ds.forEach(d => {
        if (added.has(d.source) && added.has(d.target)) {
          builder.addDependency(d.type, d.source, d.target);
        }
      });
    });
    return builder.build();
  };
}

export const onlyWorkspaceProjects = filterNodes(
  n => n.type === 'app' || n.type === 'lib' || n.type === 'e2e'
);

export function withDeps(
  original: ProjectGraph,
  subsetNodes: ProjectGraphNode[]
): ProjectGraph {
  const builder = new ProjectGraphBuilder();
  Object.values(subsetNodes).forEach(recur);
  return builder.build();

  // ---------------------------------------------------------------------------

  function recur(node) {
    const ds = original.dependencies[node.name];
    // 1. Recursively add all source nodes
    if (ds) {
      ds.forEach(n => {
        recur(original.nodes[n.target]);
      });
    }
    // 2. Add current node
    builder.addNode(node);
    // 3. Add all source dependencies
    if (ds) {
      ds.forEach(n => {
        builder.addDependency(n.type, n.source, n.target);
      });
    }
  }
}
