import { ProjectGraph } from '@nrwl/workspace/src/core/project-graph';

export function findAllNpmDependencies(
  graph: ProjectGraph,
  projectName: string,
  list: string[] = [],
  seen = new Set<string>()
) {
  // In case of bad circular dependencies
  if (seen.has(projectName)) return list;
  seen.add(projectName);

  const node = graph.nodes[projectName];

  // Don't want to include '@nrwl/react-native' because React Native
  // autolink will warn that the package has no podspec file for iOS.
  if (node.type === 'npm' && node.name !== 'npm:@nrwl/react-native')
    list.push(node.data.packageName);

  graph.dependencies[projectName]?.forEach((dep) =>
    findAllNpmDependencies(graph, dep.target, list, seen)
  );

  return list;
}
