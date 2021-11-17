import { Observable } from 'rxjs/internal/Observable';
import { TaskCompleteEvent, TasksRunner } from './tasks-runner';
import type { ProjectGraph, NxJsonConfiguration, Task } from '@nrwl/devkit';
import { TaskOrchestrator } from './task-orchestrator';
import { performance } from 'perf_hooks';
import { TaskGraphCreator } from './task-graph-creator';
import { Hasher } from '../core/hasher/hasher';

export interface RemoteCache {
  retrieve: (hash: string, cacheDirectory: string) => Promise<boolean>;
  store: (hash: string, cacheDirectory: string) => Promise<boolean>;
}

export interface LifeCycle {
  scheduleTask?(task: Task): void;

  startTask(task: Task): void;

  endTask(task: Task, code: number): void;

  startTasks?(task: Task[]): void;

  endTasks?(taskResults: Array<{ task: Task; code: number }>): void;
}

class NoopLifeCycle implements LifeCycle {
  scheduleTask(task: Task): void {}

  startTask(task: Task): void {}

  endTask(task: Task, code: number): void {}

  startTasks(task: Task[]): void {}

  endTasks(taskResults: Array<{ task: Task; code: number }>): void {}
}

export interface DefaultTasksRunnerOptions {
  parallel?: number;
  cacheableOperations?: string[];
  cacheableTargets?: string[];
  runtimeCacheInputs?: string[];
  cacheDirectory?: string;
  remoteCache?: RemoteCache;
  lifeCycle?: LifeCycle;
  captureStderr?: boolean;
  skipNxCache?: boolean;
}

export const defaultTasksRunner: TasksRunner<DefaultTasksRunnerOptions> = (
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: {
    target: string;
    initiatingProject?: string;
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    hideCachedOutput?: boolean;
  }
): Observable<TaskCompleteEvent> => {
  if (
    (options as any)['parallel'] === 'false' ||
    (options as any)['parallel'] === false
  ) {
    (options as any)['parallel'] = 1;
  } else if (
    (options as any)['parallel'] === 'true' ||
    (options as any)['parallel'] === true
  ) {
    (options as any)['parallel'] = Number((options as any)['maxParallel'] || 3);
  } else if (options.parallel === undefined) {
    options.parallel = Number((options as any)['maxParallel'] || 3);
  }

  if (!options.lifeCycle) {
    options.lifeCycle = new NoopLifeCycle();
  }

  return new Observable((subscriber) => {
    runAllTasks(tasks, options, context)
      .then((data) => data.forEach((d) => subscriber.next(d)))
      .catch((e) => {
        console.error('Unexpected error:');
        console.error(e);
        process.exit(1);
      })
      .finally(() => {
        subscriber.complete();
        // fix for https://github.com/nrwl/nx/issues/1666
        if (process.stdin['unref']) (process.stdin as any).unref();
      });
  });
};

function printTaskExecution(orchestrator: TaskOrchestrator) {
  if (process.env.NX_PERF_LOGGING) {
    console.log('Task Execution Timings:');
    const timings = {};
    Object.keys(orchestrator.timings).forEach((p) => {
      const t = orchestrator.timings[p];
      timings[p] = t.end ? t.end - t.start : null;
    });
    console.log(JSON.stringify(timings, null, 2));
  }
}

async function runAllTasks(
  tasks: Task[],
  options: DefaultTasksRunnerOptions,
  context: {
    initiatingProject?: string;
    projectGraph: ProjectGraph;
    nxJson: NxJsonConfiguration;
    hideCachedOutput?: boolean;
  }
): Promise<Array<{ task: Task; type: any; success: boolean }>> {
  const defaultTargetDependencies = context.nxJson.targetDependencies ?? {};

  const taskGraphCreator = new TaskGraphCreator(
    context.projectGraph,
    defaultTargetDependencies
  );

  const taskGraph = taskGraphCreator.createTaskGraph(tasks);

  performance.mark('task-graph-created');

  performance.measure('nx-prep-work', 'init-local', 'task-graph-created');
  performance.measure(
    'graph-creation',
    'command-execution-begins',
    'task-graph-created'
  );

  const hasher = new Hasher(context.projectGraph, context.nxJson, options);

  const orchestrator = new TaskOrchestrator(
    hasher,
    context.initiatingProject,
    context.projectGraph,
    taskGraph,
    options,
    context.hideCachedOutput
  );

  const res = await orchestrator.run();
  printTaskExecution(orchestrator);
  return res;
}

export default defaultTasksRunner;
