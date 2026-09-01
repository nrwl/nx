import { output } from '../../utils/output';
import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import {
  filterAffected,
  filterAffectedWithReasons,
} from '../../project-graph/affected/affected-project-graph';
import { printAffectedExplanation } from '../../project-graph/affected/print-explanation';
import { computeAffectedTasks } from '../../project-graph/affected/affected-tasks';
import { resolveAffectedGranularity } from '../../project-graph/affected/granularity';
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

export async function showProjectsHandler(
  args: ShowProjectsOptions
): Promise<void> {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');
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

  // Affected touches dependencies so it needs to be processed first.
  if (args.affected) {
    const touchedFiles = await getTouchedFiles(nxArgs);

    // With a target in hand, answer the question the target implies: which
    // projects have an affected *task* for it, not which affected projects
    // happen to define it. Without this, `show projects --affected -t build`
    // and `affected -t build` disagree, and the documented CI pattern is to
    // feed the first into the second.
    if (
      resolveAffectedGranularity() === 'task' &&
      args.withTarget?.length &&
      !args.projects
    ) {
      const affectedTasks = await computeAffectedTasks({
        projectGraph: graph,
        nxJson,
        targets: args.withTarget,
        touchedFiles,
        explain: nxArgs.explain !== undefined,
      });
      if (nxArgs.explain !== undefined) {
        printAffectedExplanation(
          affectedTasks.reasons ?? {},
          'Affected tasks',
          { json: nxArgs.explain === 'json' || args.json }
        );
        await output.drain();
        return;
      }
      const owning = new Set(
        [...affectedTasks.affectedTaskIds].map(
          (id) => affectedTasks.taskGraph.tasks[id].target.project
        )
      );
      graph = {
        ...graph,
        nodes: Object.fromEntries(
          Object.entries(graph.nodes).filter(([name]) => owning.has(name))
        ),
      };
    } else if (nxArgs.explain !== undefined) {
      // Reports the selection rather than filtering to it, so the later
      // --projects and --withTarget filters would only obscure the answer.
      const { reasons } = await filterAffectedWithReasons(
        graph,
        touchedFiles,
        nxJson
      );
      printAffectedExplanation(reasons, 'Affected projects', {
        json: nxArgs.explain === 'json' || args.json,
      });
      await output.drain();
      return;
    } else {
      graph = await getAffectedGraph(touchedFiles, nxJson, graph);
    }
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
