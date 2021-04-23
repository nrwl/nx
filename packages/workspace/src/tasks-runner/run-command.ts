import { AffectedEventType, Task, TasksRunner } from './tasks-runner';
import { join } from 'path';
import { appRootPath } from '../utilities/app-root';
import { Reporter, ReporterArgs } from './reporter';
import * as yargs from 'yargs';
import {
  ProjectGraph,
  ProjectGraphNode,
  TargetDependencyConfig,
} from '@nrwl/devkit';
import { Environment, NxJson } from '../core/shared-interfaces';
import { NxArgs } from '@nrwl/workspace/src/command-line/utils';
import { isRelativePath } from '../utilities/fileutils';
import { Hasher } from '../core/hasher/hasher';
import {
  projectHasTarget,
  projectHasTargetAndConfiguration,
} from '../utilities/project-graph-utils';
import { output } from '../utilities/output';
import { getDefaultDependencyConfigs, getDependencyConfigs } from './utils';

type RunArgs = yargs.Arguments & ReporterArgs;

export async function runCommand<T extends RunArgs>(
  projectsToRun: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  { nxJson, workspaceResults }: Environment,
  nxArgs: NxArgs,
  overrides: any,
  reporter: Reporter,
  initiatingProject: string | null
) {
  const { tasksRunner, runnerOptions } = getRunner(nxArgs, nxJson);

  const defaultDependencyConfigs = getDefaultDependencyConfigs(nxJson);
  const tasks = createTasksForProjectToRun(
    projectsToRun,
    {
      target: nxArgs.target,
      configuration: nxArgs.configuration,
      overrides,
    },
    projectGraph,
    initiatingProject,
    defaultDependencyConfigs
  );

  reporter.beforeRun(
    projectsToRun.map((p) => p.name),
    tasks,
    nxArgs,
    overrides
  );

  const hasher = new Hasher(projectGraph, nxJson, runnerOptions);
  const res = await hasher.hashTasks(tasks);
  for (let i = 0; i < res.length; ++i) {
    tasks[i].hash = res[i].value;
    tasks[i].hashDetails = res[i].details;
  }
  const cachedTasks: Task[] = [];
  const failedTasks: Task[] = [];
  tasksRunner(tasks, runnerOptions, {
    initiatingProject,
    target: nxArgs.target,
    projectGraph,
    nxJson,
  }).subscribe({
    next: (event: any) => {
      switch (event.type) {
        case AffectedEventType.TaskComplete: {
          if (
            projectsToRun
              .map((project) => project.name)
              .includes(event.task.target.project) &&
            event.task.target.target === nxArgs.target
          ) {
            workspaceResults.setResult(
              event.task.target.project,
              event.success
            );
          }
          if (!event.success) {
            failedTasks.push(event.task);
          }
          break;
        }
        case AffectedEventType.TaskCacheRead: {
          if (
            projectsToRun
              .map((project) => project.name)
              .includes(event.task.target.project) &&
            event.task.target.target === nxArgs.target
          ) {
            workspaceResults.setResult(
              event.task.target.project,
              event.success
            );
          }
          cachedTasks.push(event.task);
          if (!event.success) {
            failedTasks.push(event.task);
          }
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
        tasks,
        failedTasks,
        cachedTasks
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

export function createTasksForProjectToRun(
  projectsToRun: ProjectGraphNode[],
  params: Omit<TaskParams, 'project' | 'errorIfCannotFindConfiguration'>,
  projectGraph: ProjectGraph,
  initiatingProject: string | null,
  defaultDependencyConfigs: Record<string, TargetDependencyConfig[]> = {}
) {
  const tasksMap: Map<string, Task> = new Map<string, Task>();

  for (const project of projectsToRun) {
    addTasksForProjectTarget(
      {
        project,
        ...params,
        errorIfCannotFindConfiguration: project.name === initiatingProject,
      },
      defaultDependencyConfigs,
      projectGraph,
      tasksMap,
      []
    );
  }
  return Array.from(tasksMap.values());
}

function addTasksForProjectTarget(
  {
    project,
    target,
    configuration,
    overrides,
    errorIfCannotFindConfiguration,
  }: TaskParams,
  defaultDependencyConfigs: Record<string, TargetDependencyConfig[]> = {},
  projectGraph: ProjectGraph,
  tasksMap: Map<string, Task>,
  path: string[]
) {
  const task = createTask({
    project,
    target,
    configuration,
    overrides,
    errorIfCannotFindConfiguration,
  });

  const dependencyConfigs = getDependencyConfigs(
    { project: project.name, target },
    defaultDependencyConfigs,
    projectGraph
  );

  if (dependencyConfigs) {
    for (const dependencyConfig of dependencyConfigs) {
      addTasksForProjectDependencyConfig(
        project,
        {
          target,
          configuration,
        },
        dependencyConfig,
        defaultDependencyConfigs,
        projectGraph,
        tasksMap,
        path
      );
    }
  }
  tasksMap.set(task.id, task);
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
      title: `Cannot find configuration '${configuration}' for project '${project.name}:${target}'`,
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

function addTasksForProjectDependencyConfig(
  project: ProjectGraphNode,
  { target, configuration }: Pick<TaskParams, 'target' | 'configuration'>,
  dependencyConfig: TargetDependencyConfig,
  defaultDependencyConfigs: Record<string, TargetDependencyConfig[]>,
  projectGraph: ProjectGraph,
  tasksMap: Map<string, Task>,
  path: string[]
) {
  const targetIdentifier = getId({
    project: project.name,
    target,
    configuration,
  });

  if (path.includes(targetIdentifier)) {
    output.error({
      title: `Could not execute ${path[0]} because it has a circular dependency`,
      bodyLines: [`${[...path, targetIdentifier].join(' --> ')}`],
    });
    process.exit(1);
  }

  if (tasksMap.has(targetIdentifier)) {
    return;
  }

  if (dependencyConfig.projects === 'dependencies') {
    const dependencies = projectGraph.dependencies[project.name];
    for (const dep of dependencies) {
      const depProject = projectGraph.nodes[dep.target];
      if (projectHasTarget(depProject, dependencyConfig.target)) {
        addTasksForProjectTarget(
          {
            project: projectGraph.nodes[dep.target],
            target: dependencyConfig.target,
            configuration,
            overrides: {},
            errorIfCannotFindConfiguration: false,
          },
          defaultDependencyConfigs,
          projectGraph,
          tasksMap,
          [...path, targetIdentifier]
        );
      }
    }
  } else {
    addTasksForProjectTarget(
      {
        project,
        target: dependencyConfig.target,
        configuration,
        overrides: {},
        errorIfCannotFindConfiguration: true,
      },
      defaultDependencyConfigs,
      projectGraph,
      tasksMap,
      [...path, targetIdentifier]
    );
  }
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
  let id = `${project}:${target}`;
  if (configuration) {
    id += `:${configuration}`;
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
