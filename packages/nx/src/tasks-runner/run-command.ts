import { TasksRunner, TaskStatus } from './tasks-runner';
import { join } from 'path';
import { workspaceRoot } from '../utils/workspace-root';
import { NxArgs } from '../utils/command-line-utils';
import { isRelativePath } from '../utils/fileutils';
import { output } from '../utils/output';
import { shouldStreamOutput } from './utils';
import { CompositeLifeCycle, LifeCycle } from './life-cycle';
import { StaticRunManyTerminalOutputLifeCycle } from './life-cycles/static-run-many-terminal-output-life-cycle';
import { StaticRunOneTerminalOutputLifeCycle } from './life-cycles/static-run-one-terminal-output-life-cycle';
import { TaskTimingsLifeCycle } from './life-cycles/task-timings-life-cycle';
import { createRunManyDynamicOutputRenderer } from './life-cycles/dynamic-run-many-terminal-output-life-cycle';
import { TaskProfilingLifeCycle } from './life-cycles/task-profiling-life-cycle';
import { isCI } from '../utils/is-ci';
import { createRunOneDynamicOutputRenderer } from './life-cycles/dynamic-run-one-terminal-output-life-cycle';
import { ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import {
  NxJsonConfiguration,
  TargetDefaults,
  TargetDependencies,
} from '../config/nx-json';
import { Task } from '../config/task-graph';
import { createTaskGraph } from './create-task-graph';
import { findCycle, makeAcyclic } from './task-graph-utils';
import { TargetDependencyConfig } from '../config/workspace-json-project-json';
import { handleErrors } from '../utils/params';

async function getTerminalOutputLifeCycle(
  initiatingProject: string,
  projectNames: string[],
  tasks: Task[],
  nxArgs: NxArgs,
  overrides: Record<string, unknown>,
  runnerOptions: any
): Promise<{ lifeCycle: LifeCycle; renderIsDone: Promise<void> }> {
  const isRunOne = initiatingProject != null;
  const useDynamicOutput =
    shouldUseDynamicLifeCycle(tasks, runnerOptions, nxArgs.outputStyle) &&
    process.env.NX_VERBOSE_LOGGING !== 'true' &&
    process.env.NX_TASKS_RUNNER_DYNAMIC_OUTPUT !== 'false';

  const overridesWithoutHidden = { ...overrides };
  delete overridesWithoutHidden['__overrides_unparsed__'];

  if (isRunOne) {
    if (useDynamicOutput) {
      return await createRunOneDynamicOutputRenderer({
        initiatingProject,
        tasks,
        args: nxArgs,
        overrides: overridesWithoutHidden,
      });
    }
    return {
      lifeCycle: new StaticRunOneTerminalOutputLifeCycle(
        initiatingProject,
        projectNames,
        tasks,
        nxArgs
      ),
      renderIsDone: Promise.resolve(),
    };
  } else {
    if (useDynamicOutput) {
      return await createRunManyDynamicOutputRenderer({
        projectNames,
        tasks,
        args: nxArgs,
        overrides: overridesWithoutHidden,
      });
    } else {
      return {
        lifeCycle: new StaticRunManyTerminalOutputLifeCycle(
          projectNames,
          tasks,
          nxArgs,
          overridesWithoutHidden
        ),
        renderIsDone: Promise.resolve(),
      };
    }
  }
}

export async function runCommand(
  projectsToRun: ProjectGraphProjectNode[],
  projectGraph: ProjectGraph,
  { nxJson }: { nxJson: NxJsonConfiguration },
  nxArgs: NxArgs,
  overrides: any,
  initiatingProject: string | null,
  extraTargetDependencies: Record<string, (TargetDependencyConfig | string)[]>
) {
  const status = await handleErrors(overrides['verbose'] === true, async () => {
    const { tasksRunner, runnerOptions } = getRunner(nxArgs, nxJson);

    const defaultDependencyConfigs = mergeTargetDependencies(
      nxJson.targetDefaults,
      extraTargetDependencies
    );
    const projectNames = projectsToRun.map((t) => t.name);
    const taskGraph = createTaskGraph(
      projectGraph,
      defaultDependencyConfigs,
      projectNames,
      [nxArgs.target],
      nxArgs.configuration,
      overrides
    );

    const cycle = findCycle(taskGraph);
    if (cycle) {
      if (nxArgs.nxIgnoreCycles) {
        output.warn({
          title: `The task graph has a circular dependency`,
          bodyLines: [`${cycle.join(' --> ')}`],
        });
        makeAcyclic(taskGraph);
      } else {
        output.error({
          title: `Could not execute command because the task graph has a circular dependency`,
          bodyLines: [`${cycle.join(' --> ')}`],
        });
        process.exit(1);
      }
    }

    const tasks = Object.values(taskGraph.tasks);
    if (nxArgs.outputStyle == 'stream') {
      process.env.NX_STREAM_OUTPUT = 'true';
      process.env.NX_PREFIX_OUTPUT = 'true';
    }
    if (nxArgs.outputStyle == 'stream-without-prefixes') {
      process.env.NX_STREAM_OUTPUT = 'true';
    }
    const { lifeCycle, renderIsDone } = await getTerminalOutputLifeCycle(
      initiatingProject,
      projectNames,
      tasks,
      nxArgs,
      overrides,
      runnerOptions
    );
    const lifeCycles = [lifeCycle] as LifeCycle[];

    if (process.env.NX_PERF_LOGGING) {
      lifeCycles.push(new TaskTimingsLifeCycle());
    }

    if (process.env.NX_PROFILE) {
      lifeCycles.push(new TaskProfilingLifeCycle(process.env.NX_PROFILE));
    }

    const promiseOrObservable = tasksRunner(
      tasks,
      { ...runnerOptions, lifeCycle: new CompositeLifeCycle(lifeCycles) },
      {
        initiatingProject:
          nxArgs.outputStyle === 'compact' ? null : initiatingProject,
        target: nxArgs.target,
        projectGraph,
        nxJson,
        nxArgs,
        taskGraph,
      }
    );
    let anyFailures;
    if ((promiseOrObservable as any).subscribe) {
      anyFailures = await anyFailuresInObservable(promiseOrObservable);
    } else {
      // simply await the promise
      anyFailures = await anyFailuresInPromise(promiseOrObservable as any);
    }
    await renderIsDone;
    return anyFailures ? 1 : 0;
  });
  // fix for https://github.com/nrwl/nx/issues/1666
  if (process.stdin['unref']) (process.stdin as any).unref();
  process.exit(status);
}

function mergeTargetDependencies(
  defaults: TargetDefaults,
  deps: TargetDependencies
): TargetDependencies {
  const res = {};
  Object.keys(defaults).forEach((k) => {
    res[k] = defaults[k].dependsOn;
  });
  if (deps) {
    Object.keys(deps).forEach((k) => {
      if (res[k]) {
        res[k] = [...res[k], deps[k]];
      } else {
        res[k] = deps[k];
      }
    });

    return res;
  }
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

function shouldUseDynamicLifeCycle(
  tasks: Task[],
  options: any,
  outputStyle: string
) {
  if (!process.stdout.isTTY) return false;
  if (isCI()) return false;
  if (outputStyle === 'static' || outputStyle === 'stream') return false;

  const noForwarding = !tasks.find((t) => shouldStreamOutput(t, null, options));
  return noForwarding;
}

export function getRunner(
  nxArgs: NxArgs,
  nxJson: NxJsonConfiguration
): {
  tasksRunner: TasksRunner;
  runnerOptions: any;
} {
  let runner = nxArgs.runner;
  runner = runner || 'default';
  if (!nxJson.tasksRunnerOptions) {
    throw new Error(`Could not find any runner configurations in nx.json`);
  }
  if (nxJson.tasksRunnerOptions[runner]) {
    let modulePath: string = nxJson.tasksRunnerOptions[runner].runner;

    let tasksRunner;
    if (modulePath) {
      if (isRelativePath(modulePath)) {
        modulePath = join(workspaceRoot, modulePath);
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
    throw new Error(`Could not find runner configuration for ${runner}`);
  }
}
