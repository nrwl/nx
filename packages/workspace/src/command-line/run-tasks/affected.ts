import { basename } from 'path';
import * as yargs from 'yargs';
import { Task } from '../../tasks-runner/tasks-runner';
import { generateGraph } from '../dep-graph';
import { output } from '../output';
import { cliCommand, parseFiles, printArgsWarning } from '../shared';
import { getCommand, getOutputs } from '../../tasks-runner/utils';
import { createTask, runCommand } from './run-command';
import { Arguments, readEnvironment, splitArgs } from './utils';
import { filterAffected } from '../affected-project-graph';
import {
  createProjectGraph,
  ProjectGraph,
  ProjectGraphNode,
  ProjectType,
  reverse,
  withDeps
} from '../project-graph';
import { calculateFileChanges } from '../file-utils';

export interface YargsAffectedOptions
  extends yargs.Arguments,
    AffectedOptions {}

export interface AffectedOptions {
  target?: string;
  configuration?: string;
  runner?: string;
  parallel?: boolean;
  maxParallel?: number;
  untracked?: boolean;
  uncommitted?: boolean;
  all?: boolean;
  base?: string;
  head?: string;
  exclude?: string[];
  files?: string[];
  onlyFailed?: boolean;
  'only-failed'?: boolean;
  'max-parallel'?: boolean;
  verbose?: boolean;
  help?: boolean;
  version?: boolean;
  quiet?: boolean;
  plain?: boolean;
  withDeps?: boolean;
}

export function affected(
  command: string,
  parsedArgs: YargsAffectedOptions
): void {
  const env = readEnvironment(parsedArgs.target);
  const projectGraph = createProjectGraph();

  const fileChanges = readFileChanges(parsedArgs);
  let affectedGraph = filterAffected(projectGraph, fileChanges);
  if (parsedArgs.withDeps) {
    affectedGraph = withDeps(projectGraph, affectedGraph);
  }

  const projects = Object.values(
    parsedArgs.all ? projectGraph.nodes : affectedGraph.nodes
  )
    .filter(n => !parsedArgs.exclude.includes(n.name))
    .filter(n => !parsedArgs.onlyFailed || !env.workspace.getResult(n.name));

  try {
    switch (command) {
      case 'apps':
        const apps = projects
          .filter(p => p.type === ProjectType.app)
          .map(p => p.name);
        if (parsedArgs.plain) {
          console.log(apps.join(' '));
        } else {
          printArgsWarning(parsedArgs);
          if (apps.length) {
            output.log({
              title: 'Affected apps:',
              bodyLines: apps.map(app => `${output.colors.gray('-')} ${app}`)
            });
          }
        }
        break;

      case 'libs':
        const libs = projects
          .filter(p => p.type === ProjectType.lib)
          .map(p => p.name);
        if (parsedArgs.plain) {
          console.log(libs.join(' '));
        } else {
          printArgsWarning(parsedArgs);
          if (libs.length) {
            output.log({
              title: 'Affected libs:',
              bodyLines: libs.map(lib => `${output.colors.gray('-')} ${lib}`)
            });
          }
        }
        break;

      case 'print-affected':
        if (parsedArgs && parsedArgs.target) {
          const {
            args,
            projectWithTargetAndConfig
          } = allProjectsWithTargetAndConfiguration(projects, parsedArgs);
          printAffectedWithTasks(
            projectWithTargetAndConfig,
            projects,
            projectGraph,
            args
          );
        } else {
          printAffectedWithoutTasks(projects, projectGraph);
        }
        break;

      case 'dep-graph': {
        const projectNames = projects.map(p => p.name);
        printArgsWarning(parsedArgs);
        generateGraph(parsedArgs as any, projectNames);
        break;
      }

      case 'affected': {
        const {
          args,
          projectWithTargetAndConfig
        } = allProjectsWithTargetAndConfiguration(projects, parsedArgs);
        printArgsWarning(parsedArgs);

        runCommand(projectWithTargetAndConfig, projectGraph, args, env);
        break;
      }
    }
  } catch (e) {
    printError(e, parsedArgs.verbose);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------

function readFileChanges(parsedArgs: YargsAffectedOptions) {
  // Do we still need this `--all` option?
  if (parsedArgs.all) {
    return [];
  }

  const files = parseFiles(parsedArgs).files;
  return calculateFileChanges(files, parsedArgs.base, parsedArgs.head);
}

function allProjectsWithTargetAndConfiguration(
  projects: ProjectGraphNode[],
  parsedArgs: YargsAffectedOptions
) {
  const args = splitArgs(parsedArgs, nxSpecificFlags);
  const projectWithTargetAndConfig = projects.filter(p =>
    projectHasTargetAndConfiguration(
      p,
      args.nxArgs.target,
      args.nxArgs.configuration
    )
  );
  return { args, projectWithTargetAndConfig };
}

function projectHasTargetAndConfiguration(
  project: ProjectGraphNode,
  target: string,
  configuration?: string
) {
  if (!project.data.architect[target]) {
    return false;
  }

  if (!configuration) {
    return !!project.data.architect[target];
  } else {
    return (
      project.data.architect[target].configurations &&
      project.data.architect[target].configurations[configuration]
    );
  }
}

function printError(e: any, verbose?: boolean) {
  const bodyLines = [e.message];
  if (verbose && e.stack) {
    bodyLines.push('');
    bodyLines.push(e.stack);
  }
  output.error({
    title: 'There was a critical error when running your command',
    bodyLines
  });
}

function printAffectedWithTasks(
  affectedProjectsWithTargetAndConfig: ProjectGraphNode[],
  affectedProjects: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  args: Arguments<YargsAffectedOptions>
) {
  const tasks: Task[] = affectedProjectsWithTargetAndConfig.map(
    affectedProject =>
      createTask({
        project: affectedProject,
        target: args.nxArgs.target,
        configuration: args.nxArgs.configuration,
        overrides: args.overrides
      })
  );
  const cli = cliCommand();
  const isYarn = basename(process.env.npm_execpath || 'npm').startsWith('yarn');
  const projectNames = affectedProjects.map(p => p.name);
  const tasksJson = tasks.map(task => ({
    id: task.id,
    overrides: task.overrides,
    target: task.target,
    command: `${isYarn ? 'yarn' : 'npm run'} ${getCommand(cli, isYarn, task)}`,
    outputs: getOutputs(projectGraph.nodes, task)
  }));
  console.log(
    JSON.stringify(
      {
        tasks: tasksJson,
        projects: projectNames,
        projectGraph: serializeProjectGraph(projectGraph)
      },
      null,
      2
    )
  );
}

function printAffectedWithoutTasks(
  affectedProjects: ProjectGraphNode[],
  projectGraph: ProjectGraph
) {
  const projectNames = affectedProjects.map(p => p.name);
  console.log(
    JSON.stringify(
      {
        tasks: [],
        projects: projectNames,
        projectGraph: serializeProjectGraph(projectGraph)
      },
      null,
      2
    )
  );
}

function serializeProjectGraph(projectGraph: ProjectGraph) {
  const nodes = Object.values(projectGraph.nodes).map(n => n.name);
  return { nodes, dependencies: projectGraph.dependencies };
}

/**
 * These options are only for getting an array with properties of AffectedOptions.
 *
 * @remark They are not defaults or useful for anything else
 */
const dummyOptions: AffectedOptions = {
  target: '',
  configuration: '',
  onlyFailed: false,
  'only-failed': false,
  untracked: false,
  uncommitted: false,
  runner: '',
  help: false,
  version: false,
  quiet: false,
  all: false,
  base: 'base',
  head: 'head',
  exclude: ['exclude'],
  files: [''],
  verbose: false,
  plain: false
};

const nxSpecificFlags = Object.keys(dummyOptions);
