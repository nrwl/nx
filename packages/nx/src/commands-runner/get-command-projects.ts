import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { removeIdsFromGraph } from '../tasks-runner/utils';
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
