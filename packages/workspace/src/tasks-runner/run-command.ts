import { TasksRunner, TaskStatus } from './tasks-runner';
import { join } from 'path';
import { appRootPath } from '@nrwl/tao/src/utils/app-root';
import { ReporterArgs } from './reporter';
import * as yargs from 'yargs';
import type {
  NxJsonConfiguration,
  ProjectGraph,
  ProjectGraphNode,
  TargetDependencyConfig,
  Task,
} from '@nrwl/devkit';
import { logger } from '@nrwl/devkit';
import { stripIndent } from '@nrwl/tao/src/shared/logger';
import { Environment } from '../core/shared-interfaces';
import { NxArgs } from '../command-line/utils';
import { isRelativePath } from '../utilities/fileutils';
import {
  projectHasTarget,
  projectHasTargetAndConfiguration,
} from '../utilities/project-graph-utils';
import { output } from '../utilities/output';
import { getDependencyConfigs } from './utils';
import { CompositeLifeCycle, LifeCycle } from './life-cycle';
import { RunManyTerminalOutputLifeCycle } from './run-many-terminal-output-life-cycle';
import { EmptyTerminalOutputLifeCycle } from './empty-terminal-output-life-cycle';
import { RunOneTerminalOutputLifeCycle } from './run-one-terminal-output-life-cycle';
import { TaskTimingsLifeCycle } from './task-timings-life-cycle';

type RunArgs = yargs.Arguments & ReporterArgs;

function getTerminalOutputLifeCycle(
  initiatingProject: string,
  terminalOutputStrategy: 'default' | 'hide-cached-output' | 'run-one',
  projectsToRun: ProjectGraphNode[],
  tasks: Task[],
  nxArgs: NxArgs,
  overrides: any
) {
  if (terminalOutputStrategy === 'run-one') {
    return new RunOneTerminalOutputLifeCycle(
      initiatingProject,
      projectsToRun.map((t) => t.name),
      tasks,
      nxArgs
    );
  } else if (terminalOutputStrategy === 'hide-cached-output') {
    return new EmptyTerminalOutputLifeCycle();
  } else {
    return new RunManyTerminalOutputLifeCycle(
      projectsToRun.map((t) => t.name),
      tasks,
      nxArgs,
      overrides
    );
  }
}

export async function runCommand<T extends RunArgs>(
  projectsToRun: ProjectGraphNode[],
  projectGraph: ProjectGraph,
  { nxJson, workspaceResults }: Environment,
  nxArgs: NxArgs,
  overrides: any,
  terminalOutputStrategy: 'default' | 'hide-cached-output' | 'run-one',
  initiatingProject: string | null
) {
  if (nxArgs.onlyFailed || nxArgs['only-failed']) {
    output.warn({
      title: '--only-failed has been removed. Nx is executing all the tasks.',
    });
  }
  const { tasksRunner, runnerOptions } = getRunner(nxArgs, nxJson);

  // Doing this for backwards compatibility, should be removed in v14
  ensureTargetDependenciesBackwardCompatibility(nxJson, nxArgs);

  const defaultDependencyConfigs = nxJson.targetDependencies;
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

  const lifeCycles = [
    getTerminalOutputLifeCycle(
      initiatingProject,
      terminalOutputStrategy,
      projectsToRun,
      tasks,
      nxArgs,
      overrides
    ),
  ] as LifeCycle[];

  if (process.env.NX_PERF_LOGGING) {
    lifeCycles.push(new TaskTimingsLifeCycle(process.env.NX_PERF_LOGGING));
  }
  const lifeCycle = new CompositeLifeCycle(lifeCycles);

  const promiseOrObservable = tasksRunner(
    tasks,
    { ...runnerOptions, lifeCycle },
    {
      initiatingProject,
      target: nxArgs.target,
      projectGraph,
      nxJson,
    }
  );

  let anyFailures;
  if ((promiseOrObservable as any).subscribe) {
    anyFailures = await anyFailuresInObservable(promiseOrObservable);
  } else {
    // simply await the promise
    anyFailures = await anyFailuresInPromise(promiseOrObservable as any);
  }

  // fix for https://github.com/nrwl/nx/issues/1666
  if (process.stdin['unref']) (process.stdin as any).unref();

  process.exit(anyFailures ? 1 : 0);
}

async function anyFailuresInPromise(
  promise: Promise<{ [id: string]: TaskStatus }>
) {
  return Object.values(await promise).some(
    (v) => v === 'failure' || v === 'skipped'
  );
}

async function anyFailuresInObservable(obs: any) {
  return await new Promise((res) => {
    let anyFailures = false;
    obs.subscribe(
      (t) => {
        if (!t.success) {
          anyFailures = true;
        }
      },
      (error) => {
        output.error({
          title: 'Unhandled error in task executor',
        });
        console.error(error);
        res(true);
      },
      () => {
        res(anyFailures);
      }
    );
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
  const seenSet = new Set<string>();

  for (const project of projectsToRun) {
    addTasksForProjectTarget(
      {
        project,
        ...params,
        errorIfCannotFindConfiguration: project.name === initiatingProject,
      },
      defaultDependencyConfigs,
      projectGraph,
      project.data.targets?.[params.target]?.executor,
      tasksMap,
      [],
      seenSet
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
  originalTargetExecutor: string,
  tasksMap: Map<string, Task>,
  path: string[],
  seenSet: Set<string>
) {
  const task = createTask({
    project,
    target,
    configuration,
    overrides:
      project.data.targets?.[target]?.executor === originalTargetExecutor
        ? overrides
        : {},
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
          overrides,
        },
        dependencyConfig,
        defaultDependencyConfigs,
        projectGraph,
        originalTargetExecutor,
        tasksMap,
        path,
        seenSet
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

  configuration ??= project.data.targets?.[target]?.defaultConfiguration;

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
  {
    target,
    configuration,
    overrides,
  }: Pick<TaskParams, 'target' | 'configuration' | 'overrides'>,
  dependencyConfig: TargetDependencyConfig,
  defaultDependencyConfigs: Record<string, TargetDependencyConfig[]>,
  projectGraph: ProjectGraph,
  originalTargetExecutor: string,
  tasksMap: Map<string, Task>,
  path: string[],
  seenSet: Set<string>
) {
  const targetIdentifier = getId({
    project: project.name,
    target,
    configuration,
  });
  seenSet.add(project.name);

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
    if (dependencies) {
      for (const dep of dependencies) {
        const depProject =
          projectGraph.nodes[dep.target] ||
          projectGraph.externalNodes[dep.target];
        if (projectHasTarget(depProject, dependencyConfig.target)) {
          addTasksForProjectTarget(
            {
              project: depProject,
              target: dependencyConfig.target,
              configuration,
              overrides,
              errorIfCannotFindConfiguration: false,
            },
            defaultDependencyConfigs,
            projectGraph,
            originalTargetExecutor,
            tasksMap,
            [...path, targetIdentifier],
            seenSet
          );
        } else {
          if (seenSet.has(dep.target)) {
            continue;
          }

          addTasksForProjectDependencyConfig(
            depProject,
            { target, configuration, overrides },
            dependencyConfig,
            defaultDependencyConfigs,
            projectGraph,
            originalTargetExecutor,
            tasksMap,
            path,
            seenSet
          );
        }
      }
    }
  } else {
    addTasksForProjectTarget(
      {
        project,
        target: dependencyConfig.target,
        configuration,
        overrides,
        errorIfCannotFindConfiguration: true,
      },
      defaultDependencyConfigs,
      projectGraph,
      originalTargetExecutor,
      tasksMap,
      [...path, targetIdentifier],
      seenSet
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
  nxJson: NxJsonConfiguration
): {
  tasksRunner: TasksRunner;
  runnerOptions: any;
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

function ensureTargetDependenciesBackwardCompatibility(
  nxJson: NxJsonConfiguration,
  nxArgs: NxArgs
): void {
  nxJson.targetDependencies ??= {};
  if (nxArgs.withDeps) {
    logger.warn(
      stripIndent(`
        DEPRECATION WARNING: --with-deps is deprecated and it will be removed in v14.
        Configure target dependencies instead: https://nx.dev/configuration/projectjson
      `)
    );

    if (!nxJson.targetDependencies[nxArgs.target]) {
      nxJson.targetDependencies[nxArgs.target] = [
        { target: nxArgs.target, projects: 'dependencies' },
      ];
    }
  }
}
