import { filterAffected } from '../../project-graph/affected/affected-project-graph';
import {
  calculateFileChanges,
  readNxJson,
} from '../../project-graph/file-utils';
import {
  NxArgs,
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { NxJsonConfiguration } from '../../config/nx-json';
import { ProjectGraph } from '../../config/project-graph';
import { findMatchingProjects } from '../../utils/find-matching-projects';

export type ShowProjectOptions = {
  exclude: string;
  files: string;
  uncommitted: any;
  untracked: any;
  base: string;
  head: string;
  affected: boolean;
};

export async function showProjectsHandler(
  args: ShowProjectOptions
): Promise<void> {
  let graph = await createProjectGraphAsync();
  const nxJson = readNxJson();
  const { nxArgs } = splitArgsIntoNxArgsAndOverrides(
    args,
    'affected',
    {
      printWarnings: false,
    },
    nxJson
  );

  if (args.affected) {
    graph = await getAffectedGraph(nxArgs, nxJson, graph);
  }

  const selectedProjects = new Set(Object.keys(graph.nodes))

  if (args.exclude) {
    const excludedProjects = findMatchingProjects(nxArgs.exclude, graph.nodes);
    for (const excludedProject of excludedProjects) {
      selectedProjects.delete(excludedProject);
    }
  }

  const projects = Array.from(selectedProjects).join('\n');
  if (projects.length) {
    console.log(projects);
  }
}

function getAffectedGraph(
  nxArgs: NxArgs,
  nxJson: NxJsonConfiguration<'*' | string[]>,
  graph: ProjectGraph
) {
  return filterAffected(
    graph,
    calculateFileChanges(
      parseFiles(nxArgs).files,
      graph.allWorkspaceFiles,
      nxArgs
    ),
    nxJson
  );
}
