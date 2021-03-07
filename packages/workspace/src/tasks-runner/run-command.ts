import { AffectedEventType, Task, TasksRunner } from './tasks-runner';
import { join } from 'path';
import { appRootPath } from '../utilities/app-root';
import { ReporterArgs } from './default-reporter';
import * as yargs from 'yargs';
import { ProjectGraph, ProjectGraphNode } from '../core/project-graph';
import { Environment, NxJson } from '../core/shared-interfaces';
import { NxArgs } from '@nrwl/workspace/src/command-line/utils';
import { isRelativePath } from '../utilities/fileutils';
import { Hasher } from '../core/hasher/hasher';
import {
  projectHasTarget,
  projectHasTargetAndConfiguration,
} from '../utilities/project-graph-utils';
import { output } from '../utilities/output';

type RunArgs = yargs.Arguments & ReporterArgs;

function setParallelDefaults(options: NxArgs) {}

export async function runCommand<T extends RunArgs>(
  projectsToRun: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  { nxJson, workspaceResults }: Environment,
  nxArgs: NxArgs,
  overrides: any,
  reporter: any,
  initiatingProject: string | null
) {
  const { tasksRunner, runnerOptions } = getRunner(nxArgs, nxJson);
  // we have to special parallel because they can be overwritten in nx.json
  setParallelDefaults(runnerOptions);

  reporter.beforeRun(
    projectsToRun.map((p) => p.name),
    nxArgs,
    overrides
  );

  const tasks: Task[] = projectsToRun.map((project) => {
    return createTask({
      project,
      target: nxArgs.target,
      configuration: nxArgs.configuration,
      overrides,
      errorIfCannotFindConfiguration: project.name === initiatingProject,
    });
  });

  const hasher = new Hasher(projectGraph, nxJson, runnerOptions);
  const res = await hasher.hashTasks(tasks);
  for (let i = 0; i < res.length; ++i) {
    tasks[i].hash = res[i].value;
    tasks[i].hashDetails = res[i].details;
  }
  const cached = [];
  tasksRunner(tasks, runnerOptions, {
    initiatingProject,
    target: nxArgs.target,
    projectGraph,
    nxJson,
  }).subscribe({
    next: (event: any) => {
      switch (event.type) {
        case AffectedEventType.TaskComplete: {
          workspaceResults.setResult(event.task.target.project, event.success);
          break;
        }
        case AffectedEventType.TaskCacheRead: {
          workspaceResults.setResult(event.task.target.project, event.success);
          cached.push(event.task.target.project);
          break;
        }
      }
    },
    error: console.error,
    complete: () => {
      // fix for https://github.com/nrwl/nx/issues/1666
      if (process.stdin['unref']) (process.stdin as any).unref();

      workspaceResults.saveResults();
      reporter.printResults(
        nxArgs,
        workspaceResults.failedProjects,
        workspaceResults.startedWithFailedProjects,
        cached
      );

      if (workspaceResults.hasFailure) {
        process.exit(1);
      }
    },
  });
}

interface TaskParams {
  project: ProjectGraphNode;
  target: string;
  configuration: string;
  overrides: Object;
  errorIfCannotFindConfiguration: boolean;
}

export function createTask({
  project,
  target,
  configuration,
  overrides,
  errorIfCannotFindConfiguration,
}: TaskParams): Task {
  if (!projectHasTarget(project, target)) {
    output.error({
      title: `Cannot find target '${target}' for project '${project.name}'`,
    });
    process.exit(1);
  }

  const config = projectHasTargetAndConfiguration(
    project,
    target,
    configuration
  )
    ? configuration
    : undefined;

  if (errorIfCannotFindConfiguration && configuration && !config) {
    output.error({
      title: `Cannot find configuration '${configuration}' for project '${project.name}'`,
    });
    process.exit(1);
  }

  const qualifiedTarget = {
    project: project.name,
    target,
    configuration: config,
  };
  return {
    id: getId(qualifiedTarget),
    target: qualifiedTarget,
    projectRoot: project.data.root,
    overrides: interpolateOverrides(overrides, project.name, project.data),
  };
}

function getId({
  project,
  target,
  configuration,
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

export function getRunner(
  nxArgs: NxArgs,
  nxJson: NxJson
): {
  tasksRunner: TasksRunner;
  runnerOptions: unknown;
} {
  let runner = nxArgs.runner;

  //TODO: vsavkin remove in Nx 12
  if (!nxJson.tasksRunnerOptions) {
    const t = require('./default-tasks-runner');
    return {
      tasksRunner: t.defaultTasksRunner,
      runnerOptions: nxArgs,
    };
  }

  //TODO: vsavkin remove in Nx 12
  if (!runner && !nxJson.tasksRunnerOptions.default) {
    const t = require('./default-tasks-runner');
    return {
      tasksRunner: t.defaultTasksRunner,
      runnerOptions: nxArgs,
    };
  }

  runner = runner || 'default';

  if (nxJson.tasksRunnerOptions[runner]) {
    let modulePath: string = nxJson.tasksRunnerOptions[runner].runner;

    let tasksRunner;
    if (modulePath) {
      if (isRelativePath(modulePath)) {
        modulePath = join(appRootPath, modulePath);
      }

      tasksRunner = require(modulePath);
      // to support both babel and ts formats
      if (tasksRunner.default) {
        tasksRunner = tasksRunner.default;
      }
    } else {
      tasksRunner = require('./default-tasks-runner').defaultTasksRunner;
    }

    return {
      tasksRunner,
      runnerOptions: {
        ...nxJson.tasksRunnerOptions[runner].options,
        ...nxArgs,
      },
    };
  } else {
    output.error({
      title: `Could not find runner configuration for ${runner}`,
    });
    process.exit(1);
  }
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
