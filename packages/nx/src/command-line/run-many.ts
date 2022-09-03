import * as yargs from 'yargs';
import { runCommand } from '../tasks-runner/run-command';
import type { NxArgs, RawNxArgs } from '../utils/command-line-utils';
import { splitArgsIntoNxArgsAndOverrides } from '../utils/command-line-utils';
import { projectHasTarget } from '../utils/project-graph-utils';
import { output } from '../utils/output';
import { connectToNxCloudIfExplicitlyAsked } from './connect-to-nx-cloud';
import { performance } from 'perf_hooks';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { readNxJson } from '../config/configuration';

export async function runMany(
  args: { [k: string]: any },
  extraTargetDependencies: Record<
    string,
    (TargetDependencyConfig | string)[]
  > = {},
  extraOptions = { excludeTaskDependencies: false } as {
    excludeTaskDependencies: boolean;
  }
) {
  performance.mark('command-execution-begins');
  const nxJson = readNxJson();
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    args,
    'run-many',
    { printWarnings: true },
    nxJson
  );
  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  await connectToNxCloudIfExplicitlyAsked(nxArgs);

  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const projects = projectsToRun(nxArgs, projectGraph);

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

function projectsToRun(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph
): ProjectGraphProjectNode[] {
  const allProjects = Object.values(projectGraph.nodes);
  const excludedProjects = new Set(nxArgs.exclude ?? []);
  // --all is default now, if --projects is provided, it'll override the --all
  if (nxArgs.all && nxArgs.projects.length === 0) {
    const res = runnableForTarget(allProjects, nxArgs.target).filter(
      (proj) => !excludedProjects.has(proj.name)
    );
    res.sort((a, b) => a.name.localeCompare(b.name));
    return res;
  }
  checkForInvalidProjects(nxArgs, allProjects);
  const selectedProjects = nxArgs.projects.map((name) =>
    allProjects.find((project) => project.name === name)
  );
  return runnableForTarget(selectedProjects, nxArgs.target, true).filter(
    (proj) => !excludedProjects.has(proj.name)
  );
}

function checkForInvalidProjects(
  nxArgs: NxArgs,
  allProjects: ProjectGraphProjectNode[]
) {
  const invalid = nxArgs.projects.filter(
    (name) => !allProjects.find((p) => p.name === name)
  );
  if (invalid.length !== 0) {
    throw new Error(`Invalid projects: ${invalid.join(', ')}`);
  }
}

function runnableForTarget(
  projects: ProjectGraphProjectNode[],
  target: string,
  strict = false
): ProjectGraphProjectNode[] {
  const notRunnable = [] as ProjectGraphProjectNode[];
  const runnable = [] as ProjectGraphProjectNode[];

  for (let project of projects) {
    if (projectHasTarget(project, target)) {
      runnable.push(project);
    } else {
      notRunnable.push(project);
    }
  }

  if (strict && notRunnable.length) {
    output.warn({
      title: `the following do not have configuration for "${target}"`,
      bodyLines: notRunnable.map((p) => `- ${p.name}`),
    });
  }

  return runnable;
}
