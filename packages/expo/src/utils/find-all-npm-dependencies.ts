import { type ProjectGraph, type ProjectGraphDependency } from '@nx/devkit';

// Don't want to include '@nx/react-native' and '@nx/expo' because React Native
// autolink will warn that the package has no podspec file for iOS.
const EXCLUDED_EXTERNAL_NODES = new Set([
  'npm:@nx/react-native',
  'npm:@nrwl/react-native',
  'npm:@nx/expo',
  'npm:@nrwl/expo',
]);

type Options = {
  excludeImplicit: boolean;
};

export function findAllNpmDependencies(
  graph: ProjectGraph,
  projectName: string,
  options: Options = { excludeImplicit: false },
  seen: Set<string> = new Set<string>()
): string[] {
  // Guard Case: In case of bad circular dependencies
  if (seen.has(projectName)) return [];
  seen.add(projectName);

  // Base/Termination Case: when it finds a valid package in externalNodes
  const node = graph.externalNodes?.[projectName];
  if (node && !EXCLUDED_EXTERNAL_NODES.has(node.name)) {
    return [node.data.packageName];
  }

  // Recursive Case: Digging into related projects' dependencies
  return (
    (graph.dependencies[projectName] || [])
      // Conditional filtering based on options
      .filter(getFilterPredicate(options))
      // this is where the recursion happens
      .flatMap((dep) =>
        findAllNpmDependencies(graph, dep.target, options, seen)
      )
  );
}

// This function is used to filter out dependencies based on the options
// provided.
function getFilterPredicate(options?: Options) {
  return (dep: ProjectGraphDependency) =>
    [
      // base predicate returns true so it filters out nothing
      (_pDep: ProjectGraphDependency) => true,

      // conditionally filter implicit dependencies based on the option
      ...(options?.excludeImplicit
        ? [(pDep: ProjectGraphDependency) => pDep.type !== 'implicit']
        : []),

      // Future conditions can be added here in a similar way
    ].every((predicate) => predicate(dep));
}
