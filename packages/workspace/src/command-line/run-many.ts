import * as yargs from 'yargs';
import { runCommand } from '../tasks-runner/run-command';
import { splitArgsIntoNxArgsAndOverrides, NxArgs } from './utils';
import { output } from '../utils/output';
import {
  createProjectGraph,
  ProjectGraph,
  ProjectGraphNode,
  withDeps
} from '../core/project-graph';
import { readEnvironment } from '../core/file-utils';
import { projectHasTargetAndConfiguration } from '../utils/project-has-target-and-configuration';
import { DefaultReporter } from '../tasks-runner/default-reporter';

export function runMany(parsedArgs: yargs.Arguments): void {
  const { nxArgs, overrides } = splitArgsIntoNxArgsAndOverrides(parsedArgs);
  const env = readEnvironment(nxArgs.target);
  const projectGraph = createProjectGraph();
  const projects = projectsToRun(nxArgs, projectGraph);
  runCommand(
    projects,
    projectGraph,
    env,
    nxArgs,
    overrides,
    new DefaultReporter()
  );
}

function projectsToRun(nxArgs: NxArgs, projectGraph: ProjectGraph) {
  const allProjects = Object.values(projectGraph.nodes);
  if (nxArgs.all) {
    return runnableForTargetAndConfiguration(
      allProjects,
      nxArgs.target,
      nxArgs.configuration
    );
  } else {
    checkForInvalidProjects(nxArgs, allProjects);
    let selectedProjects = allProjects.filter(
      p => nxArgs.projects.indexOf(p.name) > -1
    );
    if (nxArgs.withDeps) {
      selectedProjects = Object.values(
        withDeps(projectGraph, selectedProjects).nodes
      );
    }
    return runnableForTargetAndConfiguration(
      selectedProjects,
      nxArgs.target,
      nxArgs.configuration,
      true
    );
  }
}

function checkForInvalidProjects(
  nxArgs: NxArgs,
  allProjects: ProjectGraphNode[]
) {
  const invalid = nxArgs.projects.filter(
    name => !allProjects.find(p => p.name === name)
  );
  if (invalid.length !== 0) {
    throw new Error(`Invalid projects: ${invalid.join(', ')}`);
  }
}

function runnableForTargetAndConfiguration(
  projects: ProjectGraphNode[],
  target: string,
  configuration?: string,
  strict = false
): ProjectGraphNode[] {
  const notRunnable = [];
  const runnable = [];

  for (let project of projects) {
    if (projectHasTargetAndConfiguration(project, target, configuration)) {
      runnable.push(project);
    } else {
      notRunnable.push(project);
    }
  }

  if (strict && notRunnable.length) {
    output.warn({
      title: `the following do not have configuration for "${target}"`,
      bodyLines: notRunnable.map(p => '- ' + p)
    });
  }

  return runnable;
}
