import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { NxArgs } from '../utils/command-line-utils';
import { CommandGraph } from './command-graph';
import { createCommandGraph } from './create-command-graph';

export function getCommandProjects(
  projectGraph: ProjectGraph,
  projects: ProjectGraphProjectNode[],
  nxArgs: NxArgs
) {
  const commandGraph = createCommandGraph(
    projectGraph,
    projects.map((project) => project.name),
    nxArgs
  );
  return getSortedProjects(commandGraph);
}

function getSortedProjects(
  commandGraph: CommandGraph,
  sortedProjects: string[] = []
): string[] {
  const roots = commandGraph.roots;
  if (!roots.length) {
    return sortedProjects;
  }
  sortedProjects.push(...roots);
  const newGraph: CommandGraph = removeIdsFromGraph<string[]>(
    commandGraph,
    roots,
    commandGraph.dependencies
  );

  return getSortedProjects(newGraph, sortedProjects);
}

function removeIdsFromGraph<T>(
  graph: {
    roots: string[];
    dependencies: Record<string, string[]>;
  },
  ids: string[],
  mapWithIds: Record<string, T>
): {
  mapWithIds: Record<string, T>;
  roots: string[];
  dependencies: Record<string, string[]>;
} {
  const filteredMapWithIds = {};
  const dependencies = {};
  const removedSet = new Set(ids);
  for (let id of Object.keys(mapWithIds)) {
    if (!removedSet.has(id)) {
      filteredMapWithIds[id] = mapWithIds[id];
      dependencies[id] = graph.dependencies[id].filter(
        (depId) => !removedSet.has(depId)
      );
    }
  }
  return {
    mapWithIds: filteredMapWithIds,
    dependencies: dependencies,
    roots: Object.keys(dependencies).filter(
      (k) => dependencies[k].length === 0
    ),
  };
}
