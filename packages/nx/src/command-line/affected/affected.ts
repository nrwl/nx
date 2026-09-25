import { calculateFileChanges } from '../../project-graph/file-utils';
import {
  runCommand,
  selectTasksForProjects,
} from '../../tasks-runner/run-command';
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

  // Task selection needs a target to select against, so `nx graph --affected`
  // and the deprecated print-affected stay project-grained.
  const useTasks =
    selectsAffectedTasks() &&
    command === 'affected' &&
    !!nxArgs.targets?.length;

  // Above the try, so an error building what to run reports the way the run's
  // own would.
  let projectGraph: ProjectGraph;
  let taskSelection: TaskSelection | undefined;
  let projects: ProjectGraphProjectNode[] = [];
  if (useTasks) {
    ({ projectGraph, taskSelection } = await computeAffectedTasks({
      nxJson,
      targets: nxArgs.targets,
      touchedFiles: calculateFileChanges(parseFiles(nxArgs).files, nxArgs),
      fileChangeArgs: {
        base: nxArgs.base,
        head: nxArgs.head,
        files: nxArgs.files,
      },
      configuration: nxArgs.configuration,
      overrides,
      extraTargetDependencies,
      excludeTaskDependencies: extraOptions.excludeTaskDependencies,
      exclude: nxArgs.exclude,
    }));
  } else {
    projectGraph = await createProjectGraphAsync({ exitOnError: true });
    projects = await getAffectedGraphNodes(nxArgs, projectGraph);
    if (command === 'affected' && !nxArgs.graph) {
      taskSelection = selectTasksForProjects(
        projectGraph,
        projectsWithTarget(projects, nxArgs),
        nxArgs,
        overrides,
        extraTargetDependencies,
        extraOptions.excludeTaskDependencies
      );
    }
  }

  try {
    switch (command) {
      case 'affected': {
        if (nxArgs.graph) {
          const projectNames = useTasks
            ? initiatingProjects(taskSelection)
            : projectsWithTarget(projects, nxArgs);
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
              taskSelection:
                taskSelection ??
                (() =>
                  selectTasksForProjects(
                    projectGraph,
                    projectNames,
                    nxArgs,
                    overrides,
                    extraTargetDependencies,
                    extraOptions.excludeTaskDependencies
                  )),
              configuration: nxArgs.configuration,
            },
            projectNames
          );
        } else {
          const status = await runCommand(
            taskSelection,
            projectGraph,
            { nxJson },
            nxArgs,
            overrides,
            null,
            extraTargetDependencies,
            extraOptions
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

  if (nxArgs.exclude) {
    const excludedProjects = new Set(
      findMatchingProjects(nxArgs.exclude, affectedGraph.nodes)
    );

    return Object.entries(affectedGraph.nodes)
      .filter(([projectName]) => !excludedProjects.has(projectName))
      .map(([, project]) => project);
  }

  return Object.values(affectedGraph.nodes);
}

function initiatingProjects(selection: TaskSelection): string[] {
  return [
    ...new Set(
      selection.initiatingTaskIds.map(
        (id) => selection.taskGraph.tasks[id].target.project
      )
    ),
  ];
}

function projectsWithTarget(
  projects: ProjectGraphProjectNode[],
  nxArgs: NxArgs
): string[] {
  return projects
    .filter((p) => nxArgs.targets.find((target) => projectHasTarget(p, target)))
    .map((p) => p.name);
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
