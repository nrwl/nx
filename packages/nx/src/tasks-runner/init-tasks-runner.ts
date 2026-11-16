import type { NxJsonConfiguration } from '../config/nx-json';
import { Task, TaskGraph, TaskGraphEdge } from '../config/task-graph';
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
import {
  getTaskDetails,
  hashTasksThatDoNotDependOnOutputsOfOtherTasks,
} from '../hasher/hash-task';
import type { UltracacheConfigurations } from '../native';
import type { ProjectGraph } from '../config/project-graph';
import { daemonClient } from '../daemon/client/client';
import { RunningTask } from './running-tasks/running-task';
import { SharedRunningTask } from './running-tasks/shared-running-task';
import { TaskResultsLifeCycle } from './life-cycles/task-results-life-cycle';
import { removeTasksFromTaskGraph } from './utils';

async function createOrchestrator(
  tasks: Task[],
  projectGraph: ProjectGraph,
  fullTaskGraph: TaskGraph,
  nxJson: NxJsonConfiguration,
  lifeCycle: LifeCycle,
  ultracacheConfigurations: UltracacheConfigurations | undefined,
  /** Keep the dependencies between `tasks`, so a batch runs and hashes them in order. */
  keepDependencies = false
) {
  loadRootEnvFiles();
  fullTaskGraph = withEdgeObjects(fullTaskGraph);

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

  const tasksById = Object.fromEntries(tasks.map((task) => [task.id, task]));
  const withoutDependencies = () =>
    Object.fromEntries(tasks.map((task) => [task.id, []]));
  // A dependency outside the call has already completed, so only the edges
  // between the call's tasks stay. The caller reads hashes off its own tasks.
  const taskGraph: TaskGraph = keepDependencies
    ? {
        ...removeTasksFromTaskGraph(
          fullTaskGraph,
          Object.keys(fullTaskGraph.tasks).filter((id) => !(id in tasksById))
        ),
        tasks: tasksById,
      }
    : {
        roots: tasks.map((task) => task.id),
        tasks: tasksById,
        dependencies: withoutDependencies(),
        continuousDependencies: withoutDependencies(),
      };

  const hasher = createTaskHasher(
    projectGraph,
    nxJson,
    options,
    ultracacheConfigurations
  );

  // A task that reads the outputs of a task in the same call hashes after that
  // task has run. Tasks that do not depend on each other hash as before.
  const hashingDeferredTaskIds = tasks.some(
    (task) => taskGraph.dependencies[task.id].length > 0
  )
    ? await hashTasksThatDoNotDependOnOutputsOfOtherTasks(
        hasher,
        projectGraph,
        fullTaskGraph,
        nxJson,
        getTaskDetails(),
        ultracacheConfigurations,
        tasks
      )
    : undefined;

  const nxArgs = {
    ...options,
    parallel: tasks.length,
    lifeCycle: compositedLifeCycle,
  };
  setEnvVarsBasedOnArgs(nxArgs, true);

  return new TaskOrchestrator(
    hasher,
    null,
    tasks,
    projectGraph,
    taskGraph,
    nxJson,
    nxArgs,
    false,
    daemonClient,
    // No argv on this path, so the output-style middleware never ran and both
    // fields are unset - this always renders `static-failures-only`. `nx.json`'s
    // `outputStyle` does not reach them; it merges under its own name.
    nxArgs.specifiedOutputStyle,
    nxArgs.resolvedOutputStyle ?? 'static-failures-only',
    fullTaskGraph,
    hashingDeferredTaskIds
  );
}

// A client bundle built before edges became objects hands plain task ids
function withEdgeObjects(taskGraph: TaskGraph): TaskGraph {
  const normalize = (edges: Record<string, (TaskGraphEdge | string)[]>) =>
    Object.fromEntries(
      Object.entries(edges).map(([taskId, taskEdges]) => [
        taskId,
        taskEdges.map((edge) =>
          typeof edge === 'string' ? { id: edge } : edge
        ),
      ])
    );
  return {
    ...taskGraph,
    dependencies: normalize(taskGraph.dependencies),
    continuousDependencies: normalize(taskGraph.continuousDependencies),
  };
}

// Nothing awaits the dispose chains below, so an unhandled rejection would take
// down a long-lived agent process.
function logDisposeFailure(e: unknown) {
  console.error('Failed to dispose the task orchestrator:', e);
}

// Agents never call `TaskOrchestrator.run()`, which sizes these limits for a CLI
// run. A call starts all its tasks at once while other calls' orchestrators stay
// alive, so each adds room for its tasks and its own orchestrator until disposed.
function reserveProcessListeners(tasks: Task[]): () => void {
  const room = tasks.length + 1;
  const adjust = (delta: number) => {
    for (const emitter of [process, process.stdout, process.stderr]) {
      const limit = emitter.getMaxListeners();
      // 0 is unlimited
      if (limit !== 0) {
        emitter.setMaxListeners(limit + delta);
      }
    }
  };
  adjust(room);
  return () => adjust(-room);
}

export async function runDiscreteTasks(
  tasks: Task[],
  projectGraph: ProjectGraph,
  fullTaskGraph: TaskGraph,
  nxJson: NxJsonConfiguration,
  lifeCycle: LifeCycle,
  /** The set to hash from, e.g. from `importUltracacheConfigurations`; omitted hashes natively. */
  ultracacheConfigurations?: UltracacheConfigurations
): Promise<Array<Promise<TaskResult[]>>> {
  // Only a batch runs its tasks in dependency order. A task outside a batch
  // starts now, so callers pass dependent tasks only when they batch together.
  const orchestrator = await createOrchestrator(
    tasks,
    projectGraph,
    fullTaskGraph,
    nxJson,
    lifeCycle,
    ultracacheConfigurations,
    true
  );
  const releaseProcessListeners = reserveProcessListeners(tasks);
  const batchResults: Array<Promise<TaskResult[]>> = [];
  try {
    await orchestrator.init();

    let groupId = 0;
    let nextBatch = orchestrator.nextBatch();
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
    // Every task here starts directly, but the schedule hashes only the tasks it admits
    orchestrator.processTasks(discreteTasks.map((task) => task.id));

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
      .finally(releaseProcessListeners)
      .catch(logDisposeFailure);
    return results;
  } catch (e) {
    // A batch started before the failure can still fork a child, which only
    // the orchestrator's exit handler reaps, so dispose once batches settle
    Promise.allSettled(batchResults)
      .then(() => orchestrator.dispose())
      .finally(releaseProcessListeners)
      .catch(logDisposeFailure);
    throw e;
  }
}

export async function runContinuousTasks(
  tasks: Task[],
  projectGraph: ProjectGraph,
  fullTaskGraph: TaskGraph,
  nxJson: NxJsonConfiguration,
  lifeCycle: LifeCycle,
  /** The set to hash from, e.g. from `importUltracacheConfigurations`; omitted hashes natively. */
  ultracacheConfigurations?: UltracacheConfigurations
) {
  const orchestrator = await createOrchestrator(
    tasks,
    projectGraph,
    fullTaskGraph,
    nxJson,
    lifeCycle,
    ultracacheConfigurations
  );
  const releaseProcessListeners = reserveProcessListeners(tasks);
  try {
    await orchestrator.init();
    orchestrator.processTasks(tasks.map((task) => task.id));
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
      .finally(releaseProcessListeners)
      .catch(logDisposeFailure);
    return runningTasks;
  } catch (e) {
    // A failure before the disposal chain above never reaches it
    orchestrator
      .dispose()
      .finally(releaseProcessListeners)
      .catch(logDisposeFailure);
    throw e;
  }
}
