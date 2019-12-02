import * as yargs from 'yargs';
import {
  ProjectNode,
  getProjectMetadata,
  getAllProjects,
  getSpecificProjects
} from '../shared';
import { runCommand } from './run-command';
import {
  readEnvironment,
  splitArgs,
  projectHasTargetAndConfiguration
} from './utils';
import { output } from '../output';

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
}

export function runMany(parsedArgs: yargs.Arguments): void {
  parsedArgs = preprocess(parsedArgs);

  const args = splitArgs(parsedArgs as YargsRunManyOptions, flags);
  const environment = readEnvironment(args.nxArgs.target);
  const { nxJson, workspaceJson } = environment;
  const { nxArgs } = args;

  const metadata = getProjectMetadata({
    existingTouchedProjects: nxArgs.projects || []
  });
  const { dependencyGraph } = metadata;

  let projects: ProjectNode[];

  if (nxArgs.all) {
    const all = getAllProjects(metadata);
    projects = runnableForTarget(all, nxArgs.target);
  } else {
    const specific = getSpecificProjects(metadata, nxArgs.projects, true);
    projects = runnableForTarget(specific, nxArgs.target, true);
  }

  runCommand(projects, dependencyGraph, args, environment);
}

function preprocess(args: yargs.Arguments): yargs.Arguments {
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

function runnableForTarget(
  projects: ProjectNode[],
  target: string,
  strict = false
): ProjectNode[] {
  const notRunnable = [];
  const runnable = [];

  for (let project of projects) {
    if (projectHasTargetAndConfiguration(project, target)) {
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
  verbose: false
};

const flags = Object.keys(dummyOptions);
