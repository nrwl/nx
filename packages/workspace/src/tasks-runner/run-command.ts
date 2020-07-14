import { AffectedEventType, Task, TasksRunner } from './tasks-runner';
import { join } from 'path';
import { appRootPath } from '../utils/app-root';
import { ReporterArgs } from './default-reporter';
import * as yargs from 'yargs';
import { ProjectGraph, ProjectGraphNode } from '../core/project-graph';
import { Environment, NxJson } from '../core/shared-interfaces';
import { NxArgs } from '@nrwl/workspace/src/command-line/utils';
import { isRelativePath } from '../utils/fileutils';
import { Hasher } from '../core/hasher/hasher';
import { projectHasTargetAndConfiguration } from '../utils/project-graph-utils';

type RunArgs = yargs.Arguments & ReporterArgs;

export async function runCommand<T extends RunArgs>(
  projectsToRun: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  { nxJson, workspaceResults }: Environment,
  nxArgs: NxArgs,
  overrides: any,
  reporter: any,
  initiatingProject: string | null
) {
  reporter.beforeRun(
    projectsToRun.map((p) => p.name),
    nxArgs,
    overrides
  );

  const { tasksRunner, tasksOptions } = getRunner(nxArgs, nxJson, {
    ...nxArgs,
    ...overrides,
  });

  const tasks: Task[] = projectsToRun.map((project) => {
    return createTask({
      project,
      target: nxArgs.target,
      configuration: nxArgs.configuration,
      overrides: overrides,
    });
  });

  const hasher = new Hasher(projectGraph, nxJson, tasksOptions);
  const res = await hasher.hashTasks(tasks);
  for (let i = 0; i < res.length; ++i) {
    tasks[i].hash = res[i].value;
    tasks[i].hashDetails = res[i].details;
  }
  const cached = [];
  tasksRunner(tasks, tasksOptions, {
    initiatingProject: initiatingProject,
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

export interface TaskParams {
  project: ProjectGraphNode;
  target: string;
  configuration: string;
  overrides: Object;
}

export function createTask({
  project,
  target,
  configuration,
  overrides,
}: TaskParams): Task {
  const config = projectHasTargetAndConfiguration(
    project,
    target,
    configuration
  )
    ? configuration
    : undefined;
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
  nxJson: NxJson,
  overrides: any
): {
  tasksRunner: TasksRunner;
  tasksOptions: unknown;
} {
  let runner = nxArgs.runner;
  if (!nxJson.tasksRunnerOptions) {
    const t = require('./default-tasks-runner');
    return {
      tasksRunner: t.defaultTasksRunner,
      tasksOptions: overrides,
    };
  }

  if (!runner && !nxJson.tasksRunnerOptions.default) {
    const t = require('./default-tasks-runner');
    return {
      tasksRunner: t.defaultTasksRunner,
      tasksOptions: overrides,
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
      tasksOptions: {
        ...nxJson.tasksRunnerOptions[runner].options,
        ...overrides,
        skipNxCache: nxArgs.skipNxCache,
      },
    };
  } else {
    throw new Error(`Could not find runner configuration for ${runner}`);
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
