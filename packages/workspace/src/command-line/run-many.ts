import * as yargs from 'yargs';
import { runCommand } from '../tasks-runner/run-command';
import type { NxArgs, RawNxArgs } from './utils';
import { splitArgsIntoNxArgsAndOverrides } from './utils';
import { createProjectGraphAsync } from '../core/project-graph';
import type { ProjectGraph, ProjectGraphNode } from '@nrwl/devkit';
import { readEnvironment } from '../core/file-utils';
import { projectHasTarget } from '../utilities/project-graph-utils';
import { output } from '../utilities/output';
import { connectToNxCloudUsingScan } from './connect-to-nx-cloud';
import { performance } from 'perf_hooks';

export async function runMany(parsedArgs: yargs.Arguments & RawNxArgs) {
  performance.mark('command-execution-begins');
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(
    parsedArgs,
    'run-many'
  );

  await connectToNxCloudUsingScan(nxArgs.scan);

  const projectGraph = await createProjectGraphAsync();
  const projects = projectsToRun(nxArgs, projectGraph);
  const env = readEnvironment();

  await runCommand(
    projects,
    projectGraph,
    env,
    nxArgs,
    overrides,
    nxArgs.hideCachedOutput ? 'hide-cached-output' : 'default',
    null
  );
}

function projectsToRun(
  nxArgs: NxArgs,
  projectGraph: ProjectGraph
): ProjectGraphNode[] {
  const allProjects = Object.values(projectGraph.nodes);
  const excludedProjects = new Set(nxArgs.exclude ?? []);
  if (nxArgs.all) {
    return runnableForTarget(allProjects, nxArgs.target).filter(
      (proj) => !excludedProjects.has(proj.name)
    );
  }
  checkForInvalidProjects(nxArgs, allProjects);
  let selectedProjects = nxArgs.projects.map((name) =>
    allProjects.find((project) => project.name === name)
  );
  return runnableForTarget(selectedProjects, nxArgs.target, true).filter(
    (proj) => !excludedProjects.has(proj.name)
  );
}

function checkForInvalidProjects(
  nxArgs: NxArgs,
  allProjects: ProjectGraphNode[]
) {
  const invalid = nxArgs.projects.filter(
    (name) => !allProjects.find((p) => p.name === name)
  );
  if (invalid.length !== 0) {
    throw new Error(`Invalid projects: ${invalid.join(', ')}`);
  }
}

function runnableForTarget(
  projects: ProjectGraphNode[],
  target: string,
  strict = false
): ProjectGraphNode[] {
  const notRunnable = [] as ProjectGraphNode[];
  const runnable = [] as ProjectGraphNode[];

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
