import { readNxJson } from '../config/configuration';
import { NxArgs } from '../utils/command-line-utils';
import { createProjectGraphAsync } from '../project-graph/project-graph';
import { Task, TaskGraph } from '../config/task-graph';
import { getRunner, invokeTasksRunner } from './run-command';
import { InvokeRunnerTerminalOutputLifeCycle } from './life-cycles/invoke-runner-terminal-output-life-cycle';
import { performance } from 'perf_hooks';
import { getOutputs } from './utils';
import { loadRootEnvFiles } from '../utils/dotenv';
import { TaskResult } from './life-cycle';
import { TaskOrchestrator } from './task-orchestrator';
import { getTaskDetails } from '../hasher/hash-task';
import { createTaskHasher } from '../hasher/create-task-hasher';
import type { ProjectGraph } from '../config/project-graph';
import type { NxJsonConfiguration } from '../config/nx-json';
import { daemonClient } from '../daemon/client/client';
import { RunningTask } from './running-tasks/running-task';

export async function initTasksRunner(nxArgs: NxArgs) {
  performance.mark('init-local');
  loadRootEnvFiles();
  const nxJson = readNxJson();
  if (nxArgs.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  return {
    invoke: async (opts: {
      tasks: Task[];
      parallel: number;
    }): Promise<{
      status: NodeJS.Process['exitCode'];
      taskGraph: TaskGraph;
      taskResults: Record<string, TaskResult>;
    }> => {
      performance.mark('code-loading:end');

      // TODO: This polyfills the outputs if someone doesn't pass a task with outputs. Remove this in Nx 20
      opts.tasks.forEach((t) => {
        if (!t.outputs) {
          t.outputs = getOutputs(projectGraph.nodes, t.target, t.overrides);
        }
      });

      const lifeCycle = new InvokeRunnerTerminalOutputLifeCycle(opts.tasks);

      const taskGraph = {
        roots: opts.tasks.map((task) => task.id),
        tasks: opts.tasks.reduce((acc, task) => {
          acc[task.id] = task;
          return acc;
        }, {} as any),
        dependencies: opts.tasks.reduce((acc, task) => {
          acc[task.id] = [];
          return acc;
        }, {} as any),
        continuousDependencies: opts.tasks.reduce((acc, task) => {
          acc[task.id] = [];
          return acc;
        }, {} as any),
      };

      const taskResults = await invokeTasksRunner({
        tasks: opts.tasks,
        projectGraph,
        taskGraph,
        lifeCycle,
        nxJson,
        nxArgs: { ...nxArgs, parallel: opts.parallel },
        loadDotEnvFiles: true,
        initiatingProject: null,
      });

      return {
        status: Object.values(taskResults).some(
          (taskResult) =>
            taskResult.status === 'failure' || taskResult.status === 'skipped'
        )
          ? 1
          : 0,
        taskGraph,
        taskResults,
      };
    },
  };
}

async function createOrchestrator(
  tasks: Task[],
  projectGraph: ProjectGraph,
  taskGraphForHashing: TaskGraph,
  nxJson: NxJsonConfiguration
) {
  loadRootEnvFiles();

  // this needs to be done before we start to run the tasks
  const taskDetails = getTaskDetails();

  const { runnerOptions: options } = getRunner({}, nxJson);

  let hasher = createTaskHasher(projectGraph, nxJson, options);

  const taskGraph: TaskGraph = {
    roots: tasks.map((task) => task.id),
    tasks: tasks.reduce((acc, task) => {
      acc[task.id] = task;
      return acc;
    }, {} as any),
    dependencies: tasks.reduce((acc, task) => {
      acc[task.id] = [];
      return acc;
    }, {} as any),
    continuousDependencies: tasks.reduce((acc, task) => {
      acc[task.id] = [];
      return acc;
    }, {} as any),
  };

  const orchestrator = new TaskOrchestrator(
    hasher,
    null,
    projectGraph,
    taskGraph,
    nxJson,
    { ...options, parallel: tasks.length },
    false,
    daemonClient,
    undefined,
    taskGraphForHashing
  );

  await Promise.all(tasks.map((task) => orchestrator.processTask(task.id)));

  return orchestrator;
}

export async function runDiscreteTasks(
  tasks: Task[],
  projectGraph: ProjectGraph,
  taskGraphForHashing: TaskGraph,
  nxJson: NxJsonConfiguration
) {
  const orchestrator = await createOrchestrator(
    tasks,
    projectGraph,
    taskGraphForHashing,
    nxJson
  );
  return tasks.map((task) =>
    orchestrator.applyFromCacheOrRunTask(true, task, 0)
  );
}

export async function runContinuousTasks(
  tasks: Task[],
  projectGraph: ProjectGraph,
  taskGraphForHashing: TaskGraph,
  nxJson: NxJsonConfiguration
) {
  const orchestrator = await createOrchestrator(
    tasks,
    projectGraph,
    taskGraphForHashing,
    nxJson
  );
  return tasks.reduce((current, task) => {
    current[task.id] = orchestrator.startContinuousTask(task, 0);
    return current;
  }, {} as Record<string, Promise<RunningTask>>);
}
