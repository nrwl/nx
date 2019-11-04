import { join, basename, posix } from 'path';
import * as yargs from 'yargs';
import * as yargsParser from 'yargs-parser';
import { defaultTasksRunner } from '../tasks-runner/default-tasks-runner';
import {
  AffectedEventType,
  Task,
  TaskCompleteEvent,
  TasksRunner
} from '../tasks-runner/tasks-runner';
import { appRootPath } from '../utils/app-root';
import { isRelativePath } from '../utils/fileutils';
import { generateGraph } from './dep-graph';
import { output } from './output';
import {
  AffectedMetadata,
  getAffectedMetadata,
  NxJson,
  parseFiles,
  printArgsWarning,
  ProjectNode,
  ProjectType,
  readNxJson,
  cliCommand
} from './shared';
import { WorkspaceResults } from './workspace-results';
import { getCommand, getOutputs } from '../tasks-runner/utils';

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

interface ProcessedArgs {
  affectedArgs: YargsAffectedOptions;
  taskOverrides: any;
  tasksRunnerOptions: any;
  tasksRunner: TasksRunner;
}

export function affected(
  command: string,
  parsedArgs: YargsAffectedOptions
): void {
  const workspaceResults = new WorkspaceResults(parsedArgs.target);

  const affectedMetadata = getAffectedMetadata(
    parsedArgs.all ? [] : parseFiles(parsedArgs).files,
    parsedArgs.withDeps
  );

  const projects = (parsedArgs.all
    ? getAllProjects(affectedMetadata)
    : getAffectedProjects(affectedMetadata)
  )
    .filter(app => !parsedArgs.exclude.includes(app.name))
    .filter(
      project =>
        !parsedArgs.onlyFailed || !workspaceResults.getResult(project.name)
    );
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
        const {
          processedArgs,
          projectWithTargetAndConfig
        } = allProjectsWithTargetAndConfiguration(projects, parsedArgs);
        printAffected(
          projectWithTargetAndConfig,
          affectedMetadata,
          processedArgs
        );
        break;

      case 'dep-graph': {
        const projectNames = projects.map(p => p.name);
        printArgsWarning(parsedArgs);
        generateGraph(parsedArgs as any, projectNames);
        break;
      }

      case 'affected': {
        const {
          processedArgs,
          projectWithTargetAndConfig
        } = allProjectsWithTargetAndConfiguration(projects, parsedArgs);
        printArgsWarning(parsedArgs);
        runCommand(
          projectWithTargetAndConfig,
          affectedMetadata,
          processedArgs,
          workspaceResults
        );
        break;
      }
    }
  } catch (e) {
    printError(e, parsedArgs.verbose);
    process.exit(1);
  }
}

function allProjectsWithTargetAndConfiguration(
  projects: ProjectNode[],
  parsedArgs: YargsAffectedOptions
) {
  const nxJson = readNxJson();
  const processedArgs = processArgs(parsedArgs, nxJson);
  const projectWithTargetAndConfig = projects.filter(p =>
    projectHasTargetAndConfiguration(
      p,
      parsedArgs.target,
      processedArgs.affectedArgs.configuration
    )
  );
  return { processedArgs, projectWithTargetAndConfig };
}

function projectHasTargetAndConfiguration(
  project: ProjectNode,
  target: string,
  configuration?: string
) {
  if (!project.architect[target]) {
    return false;
  }

  if (!configuration) {
    return !!project.architect[target];
  } else {
    return (
      project.architect[target].configurations &&
      project.architect[target].configurations[configuration]
    );
  }
}

function getAffectedProjects(
  affectedMetadata: AffectedMetadata
): ProjectNode[] {
  return filterAffectedMetadata(
    affectedMetadata,
    project => affectedMetadata.projectStates[project.name].affected
  );
}

function getAllProjects(affectedMetadata: AffectedMetadata): ProjectNode[] {
  return filterAffectedMetadata(affectedMetadata, () => true);
}

function filterAffectedMetadata(
  affectedMetadata: AffectedMetadata,
  predicate: (project) => boolean
): ProjectNode[] {
  const projects: ProjectNode[] = [];
  visit(affectedMetadata, project => {
    if (predicate(project)) {
      projects.push(project);
    }
  });
  return projects;
}
function visit(
  affectedMetadata: AffectedMetadata,
  visitor: (project: ProjectNode) => void
) {
  const visited = new Set<string>();
  function _visit(projectName: string) {
    if (visited.has(projectName)) {
      return;
    }
    visited.add(projectName);
    affectedMetadata.dependencyGraph.dependencies[projectName].forEach(dep => {
      _visit(dep.projectName);
    });
    visitor(affectedMetadata.dependencyGraph.projects[projectName]);
  }
  affectedMetadata.dependencyGraph.roots.forEach(root => {
    _visit(root);
  });
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

function printAffected(
  affectedProjects: ProjectNode[],
  affectedMetadata: AffectedMetadata,
  processedArgs: ProcessedArgs
) {
  const tasks: Task[] = affectedProjects.map(affectedProject =>
    createTask({
      project: affectedProject,
      target: processedArgs.affectedArgs.target,
      configuration: processedArgs.affectedArgs.configuration,
      overrides: processedArgs.taskOverrides
    })
  );
  const cli = cliCommand();
  const isYarn = basename(process.env.npm_execpath || 'npm').startsWith('yarn');
  const tasksJson = tasks.map(task => ({
    id: task.id,
    overrides: task.overrides,
    target: task.target,
    command: `${isYarn ? 'yarn' : 'npm run'} ${getCommand(cli, isYarn, task)}`,
    outputs: getOutputs(affectedMetadata.dependencyGraph.projects, task)
  }));
  console.log(
    JSON.stringify(
      {
        tasks: tasksJson,
        dependencyGraph: affectedMetadata.dependencyGraph
      },
      null,
      2
    )
  );
}

function runCommand(
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

  const reporter = new DefaultReporter();
  reporter.beforeRun(
    affectedProjects.map(p => p.name),
    affectedArgs,
    taskOverrides
  );

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
      reporter.printResults(
        affectedArgs,
        workspaceResults.failedProjects,
        workspaceResults.startedWithFailedProjects
      );

      if (workspaceResults.hasFailure) {
        process.exit(1);
      }
    }
  });
}

class DefaultReporter {
  beforeRun(
    affectedProjectNames: string[],
    affectedArgs: YargsAffectedOptions,
    taskOverrides: any
  ) {
    if (affectedProjectNames.length <= 0) {
      let description = `with "${affectedArgs.target}"`;
      if (affectedArgs.configuration) {
        description += ` that are configured for "${affectedArgs.configuration}"`;
      }
      output.logSingleLine(`No projects ${description} were affected`);
      return;
    }

    const bodyLines = affectedProjectNames.map(
      affectedProject => `${output.colors.gray('-')} ${affectedProject}`
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
  }

  printResults(
    affectedArgs: YargsAffectedOptions,
    failedProjectNames: string[],
    startedWithFailedProjects: boolean
  ) {
    output.addNewline();
    output.addVerticalSeparator();

    if (failedProjectNames.length === 0) {
      output.success({
        title: `Running target "${affectedArgs.target}" for affected projects succeeded`
      });

      if (affectedArgs.onlyFailed && startedWithFailedProjects) {
        output.warn({
          title: `Only affected projects ${output.underline(
            'which had previously failed'
          )} were run`,
          bodyLines: [
            `You should verify by running ${output.underline(
              'without'
            )} ${output.bold('--only-failed')}`
          ]
        });
      }
      return;
    }

    const bodyLines = [
      output.colors.gray('Failed projects:'),
      '',
      ...failedProjectNames.map(
        project => `${output.colors.gray('-')} ${project}`
      )
    ];
    if (!affectedArgs.onlyFailed && !startedWithFailedProjects) {
      bodyLines.push('');
      bodyLines.push(
        `${output.colors.gray(
          'You can isolate the above projects by passing:'
        )} ${output.bold('--only-failed')}`
      );
    }
    output.error({
      title: `Running target "${affectedArgs.target}" for affected projects failed`,
      bodyLines
    });
  }
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
