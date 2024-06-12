import {
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from '@nx/devkit';

export function sortProjectsTopologically(
  projectGraph: ProjectGraph,
  projectNodes: ProjectGraphProjectNode[]
): ProjectGraphProjectNode[] {
  const edges = new Map<ProjectGraphProjectNode, number>(
    projectNodes.map((node) => [node, 0])
  );

  const filteredDependencies: ProjectGraphDependency[] = [];
  for (const node of projectNodes) {
    const deps = projectGraph.dependencies[node.name];
    if (deps) {
      filteredDependencies.push(
        ...deps.filter((dep) => projectNodes.find((n) => n.name === dep.target))
      );
    }
  }

  filteredDependencies.forEach((dep) => {
    const sourceNode = projectGraph.nodes[dep.source];
    // dep.source depends on dep.target
    edges.set(sourceNode, (edges.get(sourceNode) || 0) + 1);
  });

  // Initialize queue with projects that have no dependencies
  const processQueue = [...edges]
    .filter(([_, count]) => count === 0)
    .map(([node]) => node);
  const sortedProjects = [];

  while (processQueue.length > 0) {
    const node = processQueue.shift();
    sortedProjects.push(node);

    // Process each project that depends on the current node
    filteredDependencies
      .filter((dep) => dep.target === node.name)
      .forEach((dep) => {
        const dependentNode = projectGraph.nodes[dep.source];
        const count = edges.get(dependentNode) - 1;
        edges.set(dependentNode, count);
        if (count === 0) {
          processQueue.push(dependentNode);
        }
      });
  }

  /**
   * We cannot reliably sort the nodes, e.g. when a circular dependency is present.
   * For releases, we allow the user to work with a graph that contains cycles, so
   * we should not throw an error here and simply return the original list of projects.
   */
  if (sortedProjects.length !== projectNodes.length) {
    return projectNodes;
  }

  return sortedProjects;
}
