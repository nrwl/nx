import { output } from '../../utils/output';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { filterAffected } from '../../project-graph/affected/affected-project-graph';
import {
  filterAffectedTasksByInputs,
  type RequestedTask,
} from '../../project-graph/affected/affected-tasks';
import {
  FileChange,
  calculateFileChanges,
} from '../../project-graph/file-utils';
import { filterNodes } from '../../project-graph/operators';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { allFileData } from '../../utils/all-file-data';
import {
  NxArgs,
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { ShowProjectsOptions } from './command-object';
import { hasCustomHasher } from './show-target/utils';

export async function showProjectsHandler(
  args: ShowProjectsOptions
): Promise<void> {
  if (args.filterByTaskInputs && !args.affected) {
    throw new Error('--filter-by-task-inputs requires --affected.');
  }
  if (args.filterByTaskInputs && !args.withTarget?.length) {
    throw new Error('--filter-by-task-inputs requires --with-target.');
  }

  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');
  const projectGraph = await createProjectGraphAsync();
  let graph = projectGraph;
  const nxJson = readNxJson();
  const { nxArgs } = splitArgsIntoNxArgsAndOverrides(
    args,
    'affected',
    {
      printWarnings: false,
    },
    nxJson
  );

  let touchedFiles: FileChange[] = [];
  // Affected touches dependencies so it needs to be processed first.
  if (args.affected) {
    touchedFiles = await getTouchedFiles(nxArgs);
    graph = await getAffectedGraph(touchedFiles, nxJson, projectGraph);
  }

  const filter = filterNodes((node) => {
    if (args.type && node.type !== args.type) {
      return false;
    }
    return true;
  });
  graph = filter(graph);

  // Apply projects filter and get resultant graph
  if (args.projects) {
    graph.nodes = getGraphNodesMatchingPatterns(graph, args.projects);
  }

  // Grab only the nodes with the specified target
  if (args.withTarget) {
    graph.nodes = Object.entries(graph.nodes).reduce(
      (acc, [name, node]) => {
        if (args.withTarget.some((target) => node.data.targets?.[target])) {
          acc[name] = node;
        }
        return acc;
      },
      {} as ProjectGraph['nodes']
    );
  }

  if (args.filterByTaskInputs) {
    const candidates = createRequestedTasks(graph, args.withTarget);
    const projectsWithMatchingInputs = new Set(
      filterAffectedTasksByInputs(
        candidates,
        projectGraph,
        nxJson,
        touchedFiles,
        (task) => hasCustomHasher(task.project, task.target, projectGraph)
      ).map((task) => task.project)
    );
    graph.nodes = Object.fromEntries(
      Object.entries(graph.nodes).filter(([project]) =>
        projectsWithMatchingInputs.has(project)
      )
    );
  }

  const selectedProjects = new Set(Object.keys(graph.nodes));

  if (args.exclude) {
    const excludedProjects = findMatchingProjects(nxArgs.exclude, graph.nodes);
    for (const excludedProject of excludedProjects) {
      selectedProjects.delete(excludedProject);
    }
  }

  if (args.json) {
    console.log(JSON.stringify(Array.from(selectedProjects)));
  } else if (args.sep) {
    console.log(Array.from(selectedProjects.values()).join(args.sep));
  } else {
    for (const project of selectedProjects) {
      console.log(project);
    }
  }

  // TODO: Find a better fix for this
  await new Promise((res) => setImmediate(res));
  await output.drain();
}

function createRequestedTasks(
  graph: ProjectGraph,
  targets: string[]
): RequestedTask[] {
  return Object.values(graph.nodes).flatMap((node) =>
    targets
      .filter((target) => node.data.targets?.[target])
      .map((target) => ({ project: node.name, target }))
  );
}

function getGraphNodesMatchingPatterns(
  graph: ProjectGraph,
  patterns: string[]
): ProjectGraph['nodes'] {
  const nodes: Record<string, ProjectGraphProjectNode> = {};
  const matches = findMatchingProjects(patterns, graph.nodes);
  for (const match of matches) {
    nodes[match] = graph.nodes[match];
  }
  return nodes;
}

function getAffectedGraph(
  touchedFiles: FileChange[],
  nxJson: NxJsonConfiguration<'*' | string[]>,
  graph: ProjectGraph
) {
  return filterAffected(graph, touchedFiles, nxJson);
}

async function getTouchedFiles(nxArgs: NxArgs): Promise<FileChange[]> {
  return calculateFileChanges(parseFiles(nxArgs).files, nxArgs);
}
