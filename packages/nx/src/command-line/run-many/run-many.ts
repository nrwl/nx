import { runCommand } from '../../tasks-runner/run-command';
import {
  NxArgs,
  readGraphFileFromGraphArg,
} from '../../utils/command-line-utils';
import { splitArgsIntoNxArgsAndOverrides } from '../../utils/command-line-utils';
import { projectHasTarget, shard } from '../../utils/project-graph-utils';
import { connectToNxCloudIfExplicitlyAsked } from '../connect/connect-to-nx-cloud';
import { performance } from 'perf_hooks';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { TargetDependencyConfig } from '../../config/workspace-json-project-json';
import { readNxJson } from '../../config/configuration';
import { output } from '../../utils/output';
import { findMatchingProjects } from '../../utils/find-matching-projects';
import { workspaceConfigurationCheck } from '../../utils/workspace-configuration-check';
import { generateGraph } from '../graph/graph';

export async function runMany(
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {},
  extraOptions = { excludeTaskDependencies: false, loadDotEnvFiles: true } as {
    excludeTaskDependencies: boolean;
    loadDotEnvFiles: boolean;
  }
) {
  performance.mark('command-execution-begins');
  workspaceConfigurationCheck();
  const nxJson = readNxJson();
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    args,
    'run-many',
    { printWarnings: args.graph !== 'stdout' },
    nxJson
  );
  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  await connectToNxCloudIfExplicitlyAsked(nxArgs);

  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = projectsToRun(nxArgs, projectGraph);

  if (nxArgs.graph) {
    const file = readGraphFileFromGraphArg(nxArgs);
    const projectNames = projects.map((t) => t.name);
    return await generateGraph(
      {
        watch: false,
        open: true,
        view: 'tasks',
        all: nxArgs.all,
        targets: nxArgs.targets,
        projects: projectNames,
        file,
      },
      projectNames
    );
  } else {
    await runCommand(
      projects,
      projectGraph,
      { nxJson },
      nxArgs,
      overrides,
      null,
      extraTargetDependencies,
      extraOptions
    );
  }
}

export function projectsToRun(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph
): ProjectGraphProjectNode[] {
  const selectedProjects: Record<string, ProjectGraphProjectNode> = {};
  const validProjects = runnableForTarget(projectGraph.nodes, nxArgs.targets);
  const invalidProjects: string[] = [];

  // --all is default now, if --projects is provided, it'll override the --all
  if (nxArgs.all && nxArgs.projects.length === 0) {
    for (const projectName of validProjects) {
      selectedProjects[projectName] = projectGraph.nodes[projectName];
    }
  } else {
    const matchingProjects = findMatchingProjects(
      nxArgs.projects,
      projectGraph.nodes
    );
    for (const project of matchingProjects) {
      if (!validProjects.has(project)) {
        invalidProjects.push(project);
      } else {
        selectedProjects[project] = projectGraph.nodes[project];
      }
    }

    if (invalidProjects.length > 0) {
      output.warn({
        title: `The following projects do not have a configuration for any of the provided targets ("${nxArgs.targets.join(
          ', '
        )}")`,
        bodyLines: invalidProjects.map((name) => `- ${name}`),
      });
    }
  }

  const excludedProjects = findMatchingProjects(
    nxArgs.exclude,
    selectedProjects
  );

  for (const excludedProject of excludedProjects) {
    delete selectedProjects[excludedProject];
  }

  let selectedProjectValues = Object.values(selectedProjects);
  
  if (nxArgs.shard) {
    try {
      selectedProjectValues = shard(selectedProjectValues, nxArgs.shard);
    } catch (err) {
      const bodyLines = [err.message];
      if (nxArgs.verbose && err.stack) {
        bodyLines.push('');
        bodyLines.push(err.stack);
      }
      output.error({
        title: 'There was a critical error when running your command',
        bodyLines,
      });
    }
  }

  return selectedProjectValues;
}

function runnableForTarget(
  projects: Record<string, ProjectGraphProjectNode>,
  targets: string[]
): Set<string> {
  const runnable = new Set<string>();
  for (let projectName in projects) {
    const project = projects[projectName];
    if (targets.find((target) => projectHasTarget(project, target))) {
      runnable.add(projectName);
    }
  }
  return runnable;
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
