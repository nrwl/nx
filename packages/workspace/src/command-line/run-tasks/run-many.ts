import * as yargs from 'yargs';
import { runCommand } from './run-command';
import {
  readEnvironment,
  splitArgs,
  projectHasTargetAndConfiguration
} from './utils';
import { output } from '../output';
import {
  createProjectGraph,
  ProjectGraph,
  ProjectGraphNode,
  withDeps
} from '../project-graph';

export type YargsRunManyOptions = yargs.Arguments & RunManyOptions;

export interface RunManyOptions {
  target: string;
  projects: string[];
  all: boolean;
  configuration?: string;
  runner?: string;
  parallel?: boolean;
  maxParallel?: number;
  onlyFailed?: boolean;
  'only-failed'?: boolean;
  'max-parallel'?: boolean;
  verbose?: boolean;
  help?: boolean;
  version?: boolean;
  quiet?: boolean;
  withDeps?: boolean;
  'with-deps'?: boolean;
}

export function runMany(parsedArgs: yargs.Arguments): void {
  const args = splitArgs(normalize(parsedArgs) as YargsRunManyOptions, flags);
  const env = readEnvironment(args.nxArgs.target);
  const projectGraph = createProjectGraph();
  const projects = projectsToRun(args.nxArgs, projectGraph);
  runCommand(projects, projectGraph, args, env);
}

function projectsToRun(nxArgs: RunManyOptions, projectGraph: ProjectGraph) {
  const allProjects = Object.values(projectGraph.nodes);
  if (nxArgs.all) {
    return runnableForTargetAndConfiguration(
      allProjects,
      nxArgs.target,
      nxArgs.configuration
    );
  } else {
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

function normalize(args: yargs.Arguments): yargs.Arguments {
  if (!args.all) {
    args.all = false;
  }

  if (!args.projects) {
    args.projects = [];
  } else {
    args.projects = args.projects.split(',').map((p: string) => p.trim());
  }

  return args;
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

const dummyOptions: RunManyOptions = {
  target: '',
  projects: [],
  all: false,
  configuration: '',
  onlyFailed: false,
  'only-failed': false,
  runner: '',
  help: false,
  version: false,
  quiet: false,
  verbose: false,
  withDeps: false,
  'with-deps': false
};

const flags = Object.keys(dummyOptions);
