import {
  Dependencies,
  DependencyGraph,
  ProjectMap,
  ProjectNode
} from '../shared-models';

export function createDepGraph(
  dependencies: Dependencies,
  projectNodes: ProjectNode[]
): DependencyGraph {
  const reverseDependencies = createReverseDependencies(dependencies);
  const projects: ProjectMap = {};
  const roots: string[] = [];

  projectNodes.forEach(project => {
    projects[project.name] = project;
    if (!reverseDependencies[project.name]) {
      roots.push(project.name);
    }
  });

  return {
    dependencies,
    reverseDependencies,
    projects,
    roots
  };
}

function createReverseDependencies(
  dependencies: Dependencies
): Record<string, string[]> {
  const reverseDepSets: { [projectName: string]: Set<string> } = {};

  Object.entries(dependencies).forEach(([depName, deps]) => {
    deps.forEach(dep => {
      reverseDepSets[dep.projectName] =
        reverseDepSets[dep.projectName] || new Set<string>();
      reverseDepSets[dep.projectName].add(depName);
    });
  });

  return Object.entries(reverseDepSets).reduce(
    (reverseDeps, [name, depSet]) => {
      reverseDeps[name] = Array.from(depSet);
      return reverseDeps;
    },
    {} as {
      [projectName: string]: string[];
    }
  );
}
