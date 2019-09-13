import * as yargs from 'yargs';
import * as yargsParser from 'yargs-parser';
import { join } from 'path';

import {
  parseFiles,
  printArgsWarning,
  getAffectedMetadata,
  AffectedMetadata,
  readNxJson,
  ProjectNode,
  NxJson
} from './shared';
import {
  getAffectedApps,
  getAffectedLibs,
  getAffectedProjects,
  getAffectedProjectsWithTargetAndConfiguration,
  getAllApps,
  getAllLibs,
  getAllProjects,
  getAllProjectsWithTargetAndConfiguration,
  projectHasTargetAndConfiguration
} from './affected-apps';
import { generateGraph } from './dep-graph';
import { WorkspaceResults } from './workspace-results';
import { output } from './output';
import {
  AffectedEventType,
  Task,
  TaskCompleteEvent,
  TasksRunner
} from '../tasks-runner/tasks-runner';
import { appRootPath } from '../utils/app-root';
import { defaultTasksRunner } from '../tasks-runner/default-tasks-runner';
import { isRelativePath } from '../utils/fileutils';

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
}

interface ProcessedArgs {
  affectedArgs: YargsAffectedOptions;
  taskOverrides: any;
  tasksRunnerOptions: any;
  tasksRunner: TasksRunner;
}

export function affected(parsedArgs: YargsAffectedOptions): void {
  const target = parsedArgs.target;

  const workspaceResults = new WorkspaceResults(target);

  const touchedFiles = parseFiles(parsedArgs).files;
  const affectedMetadata = getAffectedMetadata(touchedFiles);

  try {
    switch (target) {
      case 'apps':
        const apps = (parsedArgs.all
          ? getAllApps(affectedMetadata)
          : getAffectedApps(affectedMetadata)
        )
          .filter(affectedApp => !parsedArgs.exclude.includes(affectedApp))
          .filter(
            affectedApp =>
              !parsedArgs.onlyFailed || !workspaceResults.getResult(affectedApp)
          );
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
        const libs = (parsedArgs.all
          ? getAllLibs(affectedMetadata)
          : getAffectedLibs(affectedMetadata)
        )
          .filter(affectedLib => !parsedArgs.exclude.includes(affectedLib))
          .filter(
            affectedLib =>
              !parsedArgs.onlyFailed || !workspaceResults.getResult(affectedLib)
          );

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
      case 'dep-graph': {
        const projects = (parsedArgs.all
          ? getAllProjects(affectedMetadata)
          : getAffectedProjects(affectedMetadata)
        )
          .filter(app => !parsedArgs.exclude.includes(app))
          .filter(
            project =>
              !parsedArgs.onlyFailed || !workspaceResults.getResult(project)
          );
        printArgsWarning(parsedArgs);
        generateGraph(parsedArgs as any, projects);
        break;
      }
      default: {
        const nxJson = readNxJson();
        const processedArgs = processArgs(parsedArgs, nxJson);
        const projects = (parsedArgs.all
          ? getAllProjectsWithTargetAndConfiguration(
              affectedMetadata,
              target,
              processedArgs.affectedArgs.configuration
            )
          : getAffectedProjectsWithTargetAndConfiguration(
              affectedMetadata,
              target,
              processedArgs.affectedArgs.configuration
            )
        )
          .filter(project => !parsedArgs.exclude.includes(project.name))
          .filter(
            project =>
              !parsedArgs.onlyFailed ||
              !workspaceResults.getResult(project.name)
          );
        printArgsWarning(parsedArgs);
        runCommand(projects, affectedMetadata, processedArgs, workspaceResults);
        break;
      }
    }
  } catch (e) {
    printError(e, parsedArgs.verbose);
    process.exit(1);
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

async function runCommand(
  affectedProjects: ProjectNode[],
  affectedMetadata: AffectedMetadata,
  processedArgs: ProcessedArgs,
  workspaceResults: WorkspaceResults
) {
  const {
    affectedArgs,
    taskOverrides,
    tasksRunnerOptions,
    tasksRunner
  } = processedArgs;

  if (affectedProjects.length <= 0) {
    let description = `with "${affectedArgs.target}"`;
    if (affectedArgs.configuration) {
      description += ` that are configured for "${affectedArgs.configuration}"`;
    }
    output.logSingleLine(`No projects ${description} were affected`);
    return;
  }

  const bodyLines = affectedProjects.map(
    affectedProject => `${output.colors.gray('-')} ${affectedProject.name}`
  );
  if (Object.keys(taskOverrides).length > 0) {
    bodyLines.push('');
    bodyLines.push(`${output.colors.gray('With flags:')}`);
    Object.entries(taskOverrides)
      .map(([flag, value]) => `  --${flag}=${value}`)
      .forEach(arg => bodyLines.push(arg));
  }

  output.log({
    title: `${output.colors.gray('Running target')} ${
      affectedArgs.target
    } ${output.colors.gray('for projects:')}`,
    bodyLines
  });

  output.addVerticalSeparator();

  const tasks: Task[] = affectedProjects.map(affectedProject =>
    createTask({
      project: affectedProject,
      target: processedArgs.affectedArgs.target,
      configuration: processedArgs.affectedArgs.configuration,
      overrides: processedArgs.taskOverrides
    })
  );

  const tasksMap: {
    [projectName: string]: { [targetName: string]: Task };
  } = {};
  Object.entries(affectedMetadata.dependencyGraph.projects).forEach(
    ([projectName, project]) => {
      if (
        projectHasTargetAndConfiguration(
          project,
          processedArgs.affectedArgs.target,
          processedArgs.affectedArgs.configuration
        )
      ) {
        tasksMap[projectName] = {
          [processedArgs.affectedArgs.target]: createTask({
            project: project,
            target: processedArgs.affectedArgs.target,
            configuration: processedArgs.affectedArgs.configuration,
            overrides: processedArgs.taskOverrides
          })
        };
      }
    }
  );

  tasksRunner(tasks, tasksRunnerOptions, {
    dependencyGraph: affectedMetadata.dependencyGraph,
    tasksMap
  }).subscribe({
    next: (event: TaskCompleteEvent) => {
      switch (event.type) {
        case AffectedEventType.TaskComplete: {
          workspaceResults.setResult(event.task.target.project, event.success);
        }
      }
    },
    error: console.error,
    complete: () => {
      // fix for https://github.com/nrwl/nx/issues/1666
      if (process.stdin['unref']) (process.stdin as any).unref();

      workspaceResults.saveResults();
      workspaceResults.printResults(
        affectedArgs.onlyFailed,
        `Running target "${affectedArgs.target}" for affected projects succeeded`,
        `Running target "${affectedArgs.target}" for affected projects failed`
      );

      if (workspaceResults.hasFailure) {
        process.exit(1);
      }
    }
  });
}

function createTask({
  project,
  target,
  configuration,
  overrides
}: {
  project: ProjectNode;
  target: string;
  configuration: string;
  overrides: Object;
}): Task {
  return {
    id: getTaskId({
      project: project.name,
      target: target,
      configuration: configuration
    }),
    target: {
      project: project.name,
      target,
      configuration
    },
    overrides: interpolateOverrides(overrides, project.name, project)
  };
}

function getTaskId({
  project,
  target,
  configuration
}: {
  project: string;
  target: string;
  configuration?: string;
}): string {
  let id = project + ':' + target;
  if (configuration) {
    id += ':' + configuration;
  }
  return id;
}

function getTasksRunner(
  runner: string | undefined,
  nxJson: NxJson
): {
  tasksRunner: TasksRunner;
  options: unknown;
} {
  if (!nxJson.tasksRunnerOptions) {
    return {
      tasksRunner: defaultTasksRunner,
      options: {}
    };
  }

  if (!runner && !nxJson.tasksRunnerOptions.default) {
    return {
      tasksRunner: defaultTasksRunner,
      options: {}
    };
  }

  runner = runner || 'default';

  if (nxJson.tasksRunnerOptions[runner]) {
    let modulePath: string = nxJson.tasksRunnerOptions[runner].runner;
    if (isRelativePath(modulePath)) {
      modulePath = join(appRootPath, modulePath);
    }
    return {
      tasksRunner: require(modulePath),
      options: nxJson.tasksRunnerOptions[runner].options
    };
  } else {
    throw new Error(`Could not find runner configuration for ${runner}`);
  }
}

function getNxSpecificOptions(
  parsedArgs: YargsAffectedOptions
): YargsAffectedOptions {
  const filteredArgs = {};
  nxSpecificFlags.forEach(flag => {
    filteredArgs[flag] = parsedArgs[flag];
  });
  return filteredArgs as YargsAffectedOptions;
}

function getNonNxSpecificOptions(
  parsedArgs: YargsAffectedOptions
): YargsAffectedOptions {
  const filteredArgs = { ...parsedArgs };
  // Delete Nx arguments from parsed Args
  nxSpecificFlags.forEach(flag => {
    delete filteredArgs[flag];
  });

  // These would be arguments such as app2 in  --app app1 app2 which the CLI does not accept
  delete filteredArgs._;
  // Also remove the node path
  delete filteredArgs.$0;

  return filteredArgs;
}

export function processArgs(
  parsedArgs: YargsAffectedOptions,
  nxJson: NxJson
): ProcessedArgs {
  const affectedArgs = getNxSpecificOptions(parsedArgs);
  const { tasksRunner, options: configOptions } = getTasksRunner(
    affectedArgs.runner,
    nxJson
  );
  const tasksRunnerOptions = {
    ...configOptions,
    ...getNonNxSpecificOptions(parsedArgs)
  };
  const taskOverrides = yargsParser(parsedArgs._.slice(1));
  delete taskOverrides._;
  return {
    affectedArgs,
    taskOverrides,
    tasksRunner,
    tasksRunnerOptions: tasksRunnerOptions
  };
}

function interpolateOverrides<T = any>(
  args: T,
  projectName: string,
  projectMetadata: any
): T {
  const interpolatedArgs: T = { ...args };
  Object.entries(interpolatedArgs).forEach(([name, value]) => {
    if (typeof value === 'string') {
      const regex = /{project\.([^}]+)}/g;
      interpolatedArgs[name] = value.replace(regex, (_, group: string) => {
        if (group.includes('.')) {
          throw new Error('Only top-level properties can be interpolated');
        }

        if (group === 'name') {
          return projectName;
        }
        return projectMetadata[group];
      });
    }
  });
  return interpolatedArgs;
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
