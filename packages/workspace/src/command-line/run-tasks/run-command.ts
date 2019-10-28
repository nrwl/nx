import { DependencyGraph, NxJson, ProjectNode } from '../shared';
import {
  AffectedEventType,
  Task,
  TaskCompleteEvent,
  TasksRunner
} from '../../tasks-runner/tasks-runner';
import { defaultTasksRunner } from '../../tasks-runner/default-tasks-runner';
import { isRelativePath } from '../../utils/fileutils';
import { join } from 'path';
import { appRootPath } from '../../utils/app-root';
import { DefaultReporter, ReporterArgs } from './default-reporter';
import {
  Arguments,
  Environment,
  projectHasTargetAndConfiguration
} from './utils';
import * as yargs from 'yargs';

interface TasksMap {
  [projectName: string]: { [targetName: string]: Task };
}

type RunArgs = yargs.Arguments & ReporterArgs;

export function runCommand<T extends RunArgs>(
  projectsToRun: ProjectNode[],
  dependencyGraph: DependencyGraph,
  { nxArgs, overrides, targetArgs }: Arguments<T>,
  { nxJson, workspace }: Environment
) {
  const reporter = new DefaultReporter();
  reporter.beforeRun(projectsToRun.map(p => p.name), nxArgs, overrides);

  const tasks: Task[] = projectsToRun.map(project =>
    createTask({
      project,
      target: nxArgs.target,
      configuration: nxArgs.configuration,
      overrides: overrides
    })
  );

  const tasksMap: TasksMap = {};
  Object.entries(dependencyGraph.projects).forEach(([projectName, project]) => {
    const runnable = projectHasTargetAndConfiguration(
      project,
      nxArgs.target,
      nxArgs.configuration
    );
    if (runnable) {
      tasksMap[projectName] = {
        [nxArgs.target]: createTask({
          project: project,
          target: nxArgs.target,
          configuration: nxArgs.configuration,
          overrides: overrides
        })
      };
    }
  });

  const { tasksRunner, tasksOptions } = getRunner(
    nxArgs.runner,
    nxJson,
    targetArgs
  );
  tasksRunner(tasks, tasksOptions, {
    dependencyGraph: dependencyGraph,
    tasksMap
  }).subscribe({
    next: (event: TaskCompleteEvent) => {
      switch (event.type) {
        case AffectedEventType.TaskComplete: {
          workspace.setResult(event.task.target.project, event.success);
        }
      }
    },
    error: console.error,
    complete: () => {
      // fix for https://github.com/nrwl/nx/issues/1666
      if (process.stdin['unref']) (process.stdin as any).unref();

      workspace.saveResults();
      reporter.printResults(
        nxArgs,
        workspace.failedProjects,
        workspace.startedWithFailedProjects
      );

      if (workspace.hasFailure) {
        process.exit(1);
      }
    }
  });
}

export interface TaskParams {
  project: ProjectNode;
  target: string;
  configuration: string;
  overrides: Object;
}

export function createTask({
  project,
  target,
  configuration,
  overrides
}: TaskParams): Task {
  return {
    id: getId({
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

function getId({
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

export function getRunner(
  runner: string | undefined,
  nxJson: NxJson,
  targetArgs: any
): {
  tasksRunner: TasksRunner;
  tasksOptions: unknown;
} {
  if (!nxJson.tasksRunnerOptions) {
    return {
      tasksRunner: defaultTasksRunner,
      tasksOptions: targetArgs
    };
  }

  if (!runner && !nxJson.tasksRunnerOptions.default) {
    return {
      tasksRunner: defaultTasksRunner,
      tasksOptions: targetArgs
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
      tasksOptions: {
        ...nxJson.tasksRunnerOptions[runner].options,
        ...targetArgs
      }
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
