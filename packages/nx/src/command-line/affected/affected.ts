import { calculateFileChanges } from '../../project-graph/file-utils';
import { runCommand } from '../../tasks-runner/run-command';
import { output } from '../../utils/output';
import { connectToNxCloudIfExplicitlyAsked } from '../nx-cloud/connect/connect-to-nx-cloud';
import type { NxArgs } from '../../utils/command-line-utils';
import {
  parseFiles,
  readGraphFileFromGraphArg,
  splitArgsIntoNxArgsAndOverrides,
} from '../../utils/command-line-utils';
import { performance } from 'perf_hooks';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { projectHasTarget } from '../../utils/project-graph-utils';
import { filterAffected } from '../../project-graph/affected/affected-project-graph';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
import { readNxJson } from '../../config/configuration';
import type { NxJsonConfiguration } from '../../config/nx-json';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { generateGraph } from '../graph/graph';
import {
  computeAffectedTasks,
  selectsAffectedTasks,
} from '../../project-graph/affected/affected-tasks';
import type { TaskSelection } from '../../tasks-runner/run-command';

export async function affected(
  command: 'graph' | 'print-affected' | 'affected',
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {},
  extraOptions = {
    excludeTaskDependencies: args.excludeTaskDependencies,
    loadDotEnvFiles: process.env.NX_LOAD_DOT_ENV_FILES !== 'false',
  } as {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
  }
): Promise<void> {
  performance.mark('code-loading:end');
  performance.measure('code-loading', 'init-local', 'code-loading:end');

  const nxJson = readNxJson();
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    args,
    'affected',
    {
      printWarnings:
        command !== 'print-affected' && !args.plain && args.graph !== 'stdout',
    },
    nxJson
  );

  await connectToNxCloudIfExplicitlyAsked(nxArgs);

  const projectGraph = await createProjectGraphAsync({
    exitOnError: true,
  });
  // Task selection needs a target to select against, so `nx graph --affected`
  // and the deprecated print-affected stay project-grained.
  const useTasks =
    selectsAffectedTasks() &&
    command === 'affected' &&
    !!nxArgs.targets?.length;

  const { projects, taskSelection } = useTasks
    ? await getAffectedTasks(
        nxArgs,
        projectGraph,
        nxJson,
        overrides,
        extraTargetDependencies,
        extraOptions.excludeTaskDependencies
      )
    : { projects: await getAffectedGraphNodes(nxArgs, projectGraph) };

  try {
    switch (command) {
      case 'affected': {
        const projectsWithTarget = allProjectsWithTarget(projects, nxArgs);
        if (nxArgs.graph) {
          const projectNames = projectsWithTarget.map((t) => t.name);
          const file = readGraphFileFromGraphArg(nxArgs);

          return await generateGraph(
            {
              watch: true,
              open: true,
              view: 'tasks',
              targets: nxArgs.targets,
              all:
                nxArgs.all &&
                (!nxArgs.projects || nxArgs.projects.length === 0),
              projects: projectNames,
              file,
              selectedTaskIds: taskSelection?.taskIds,
              configuration: nxArgs.configuration,
            },
            projectNames
          );
        } else {
          const status = await runCommand(
            projectsWithTarget,
            projectGraph,
            { nxJson },
            nxArgs,
            overrides,
            null,
            extraTargetDependencies,
            extraOptions,
            taskSelection
          );
          await output.drain();
          process.exit(status);
        }
        break;
      }
    }
    await output.drain();
  } catch (e) {
    printError(e, args.verbose);
    process.exit(1);
  }
}

export async function getAffectedGraphNodes(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph
): Promise<ProjectGraphProjectNode[]> {
  let affectedGraph = nxArgs.all
    ? projectGraph
    : await filterAffected(
        projectGraph,
        calculateFileChanges(parseFiles(nxArgs).files, nxArgs)
      );

  const excluded = excludedProjects(nxArgs, affectedGraph.nodes);
  return Object.entries(affectedGraph.nodes)
    .filter(([projectName]) => !excluded.has(projectName))
    .map(([, project]) => project);
}

async function getAffectedTasks(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  overrides: Record<string, unknown>,
  extraTargetDependencies: Record<string, (TargetDependencyConfig | string)[]>,
  excludeTaskDependencies: boolean
): Promise<{
  projects: ProjectGraphProjectNode[];
  taskSelection: TaskSelection;
}> {
  const { affectedTaskIds, requiredTaskIds, taskGraph, planningContext } =
    await computeAffectedTasks({
      projectGraph,
      nxJson,
      targets: nxArgs.targets,
      touchedFiles: calculateFileChanges(parseFiles(nxArgs).files, nxArgs),
      configuration: nxArgs.configuration,
      overrides,
      extraTargetDependencies,
      excludeTaskDependencies,
      excludedProjects: [...excludedProjects(nxArgs, projectGraph.nodes)],
    });
  // runCommand still seeds the graph from projects; the prune is what narrows
  // it back down to the selected tasks and their dependencies.
  const owning = new Set(
    [...affectedTaskIds].map((id) => taskGraph.tasks[id].target.project)
  );
  return {
    projects: [...owning].map((name) => projectGraph.nodes[name]),
    taskSelection: { taskIds: requiredTaskIds, planningContext },
  };
}

function excludedProjects(
  nxArgs: NxArgs,
  nodes: Record<string, ProjectGraphProjectNode>
): Set<string> {
  return new Set(
    nxArgs.exclude ? findMatchingProjects(nxArgs.exclude, nodes) : []
  );
}

function allProjectsWithTarget(
  projects: ProjectGraphProjectNode[],
  nxArgs: NxArgs
) {
  return projects.filter((p) =>
    nxArgs.targets.find((target) => projectHasTarget(p, target))
  );
}

function printError(e: any, verbose?: boolean) {
  const bodyLines = [e.message];
  if (verbose && e.stack) {
    bodyLines.push('');
    bodyLines.push(e.stack);
  }
  output.error({
    title: 'There was a critical error when running your command',
    bodyLines,
  });
}
