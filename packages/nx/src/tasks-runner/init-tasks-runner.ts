import type { NxJsonConfiguration } from '../config/nx-json';
import { Task, TaskGraph } from '../config/task-graph';
import {
  constructLifeCycles,
  getRunner,
  setEnvVarsBasedOnArgs,
} from './run-command';
import { InvokeRunnerTerminalOutputLifeCycle } from './life-cycles/invoke-runner-terminal-output-life-cycle';
import { loadRootEnvFiles } from '../utils/dotenv';
import { CompositeLifeCycle, LifeCycle, TaskResult } from './life-cycle';
import { TaskOrchestrator } from './task-orchestrator';
import { createTaskHasher } from '../hasher/create-task-hasher';
import type { ProjectGraph } from '../config/project-graph';
import { daemonClient } from '../daemon/client/client';
import { RunningTask } from './running-tasks/running-task';
import { SharedRunningTask } from './running-tasks/shared-running-task';
import { TaskResultsLifeCycle } from './life-cycles/task-results-life-cycle';

async function createOrchestrator(
  tasks: Task[],
  projectGraph: ProjectGraph,
  fullTaskGraph: TaskGraph,
  nxJson: NxJsonConfiguration,
  lifeCycle: LifeCycle
) {
  loadRootEnvFiles();

  const invokeRunnerTerminalLifecycle = new InvokeRunnerTerminalOutputLifeCycle(
    tasks
  );
  const taskResultsLifecycle = new TaskResultsLifeCycle();
  const compositedLifeCycle: LifeCycle = new CompositeLifeCycle([
    ...constructLifeCycles(
      invokeRunnerTerminalLifecycle,
      fullTaskGraph,
      nxJson
    ),
    taskResultsLifecycle,
    lifeCycle,
  ]);

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

  const nxArgs = {
    ...options,
    parallel: tasks.length,
    lifeCycle: compositedLifeCycle,
  };
  setEnvVarsBasedOnArgs(nxArgs, true);

  const orchestrator = new TaskOrchestrator(
    hasher,
    null,
    tasks,
    projectGraph,
    taskGraph,
    nxJson,
    nxArgs,
    false,
    daemonClient,
    undefined,
    fullTaskGraph
  );

  await orchestrator.init();

  orchestrator.processAllScheduledTasks();

  return orchestrator;
}

// Nothing awaits the dispose chains below, so an unhandled rejection would take
// down a long-lived agent process.
function logDisposeFailure(e: unknown) {
  console.error('Failed to dispose the task orchestrator:', e);
}

export async function runDiscreteTasks(
  tasks: Task[],
  projectGraph: ProjectGraph,
  fullTaskGraph: TaskGraph,
  nxJson: NxJsonConfiguration,
  lifeCycle: LifeCycle
): Promise<Array<Promise<TaskResult[]>>> {
  const orchestrator = await createOrchestrator(
    tasks,
    projectGraph,
    fullTaskGraph,
    nxJson,
    lifeCycle
  );

  let groupId = 0;
  let nextBatch = orchestrator.nextBatch();
  const batchResults: Array<Promise<TaskResult[]>> = [];
  /**
   * Set of task ids that were part of batches
   */
  const batchTasks = new Set<string>();

  while (nextBatch) {
    for (const task in nextBatch.taskGraph.tasks) {
      batchTasks.add(task);
    }

    batchResults.push(
      orchestrator.applyFromCacheOrRunBatch(true, nextBatch, groupId++)
    );
    nextBatch = orchestrator.nextBatch();
  }

  const discreteTasks = tasks.filter((task) => !batchTasks.has(task.id));

  // Bulk-resolve every discrete task's cache state in one shot —
  // single SQL call plus parallel remote retrievals. Batches kicked
  // off above continue running concurrently while we await this.
  const cacheHits = await orchestrator.resolveCachedTasks(
    true,
    discreteTasks,
    groupId++
  );
  const cacheHitsById = new Map(cacheHits.map((h) => [h.task.id, h]));

  const taskResults: Array<Promise<TaskResult[]>> = discreteTasks.map(
    async (task) => {
      const hit = cacheHitsById.get(task.id);
      if (hit) return [hit];
      return [await orchestrator.runTaskDirectly(true, task, groupId++)];
    }
  );

  const results = [...batchResults, ...taskResults];
  // Callers like Nx Cloud agents create an orchestrator per invocation in a
  // long-lived process; release its process-level listeners once all tasks
  // settle, otherwise every invocation's orchestrator stays reachable forever.
  // Not awaited, so callers keep consuming handles as they settle; the forked
  // runner's exit handler still reaps children until dispose() runs.
  Promise.allSettled(results)
    .then(() => orchestrator.dispose())
    .catch(logDisposeFailure);
  return results;
}

export async function runContinuousTasks(
  tasks: Task[],
  projectGraph: ProjectGraph,
  fullTaskGraph: TaskGraph,
  nxJson: NxJsonConfiguration,
  lifeCycle: LifeCycle
) {
  const orchestrator = await createOrchestrator(
    tasks,
    projectGraph,
    fullTaskGraph,
    nxJson,
    lifeCycle
  );
  const runningTasks = tasks.reduce(
    (current, task, index) => {
      current[task.id] = orchestrator.startContinuousTask(task, index);
      return current;
    },
    {} as Record<string, Promise<RunningTask>>
  );
  // Unlike runDiscreteTasks, this must resolve at task start: callers keep
  // the RunningTask handles to kill later, so disposal has to be deferred
  // until every task actually exits.
  Promise.allSettled(
    Object.entries(runningTasks).map(async ([taskId, promise]) => {
      const runningTask = await promise;
      // A shared task is owned by another nx process; this orchestrator has
      // no child to protect for it, so disposal does not wait on it.
      if (runningTask instanceof SharedRunningTask) {
        return;
      }
      await orchestrator.waitForContinuousTaskExit(taskId);
    })
  )
    .then(() => orchestrator.dispose())
    .catch(logDisposeFailure);
  return runningTasks;
}
