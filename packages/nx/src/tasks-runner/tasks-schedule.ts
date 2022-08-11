import { Workspaces } from '../config/workspaces';

import {
  calculateReverseDeps,
  getExecutorForTask,
  getExecutorNameForTask,
  removeTasksFromTaskGraph,
} from './utils';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { Hasher } from '../hasher/hasher';
import { Task, TaskGraph } from '../config/task-graph';
import { ProjectGraph } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { hashTask } from '../hasher/hash-task';

export interface Batch {
  executorName: string;
  taskGraph: TaskGraph;
}

export class TasksSchedule {
  private notScheduledTaskGraph = this.taskGraph;
  private reverseTaskDeps = calculateReverseDeps(this.taskGraph);

  private scheduledBatches: Batch[] = [];

  private scheduledTasks: string[] = [];

  private completedTasks = new Set<string>();

  constructor(
    private readonly hasher: Hasher,
    private readonly nxJson: NxJsonConfiguration,
    private readonly projectGraph: ProjectGraph,
    private readonly taskGraph: TaskGraph,
    private readonly workspaces: Workspaces,
    private readonly options: DefaultTasksRunnerOptions
  ) {}

  public async scheduleNextTasks() {
    if (process.env.NX_BATCH_MODE === 'true') {
      this.scheduleBatches();
    }
    for (let root of this.notScheduledTaskGraph.roots) {
      if (this.canBeScheduled(root)) {
        await this.scheduleTask(root);
      }
    }
  }

  public hasTasks() {
    return (
      this.scheduledBatches.length +
        this.scheduledTasks.length +
        Object.keys(this.notScheduledTaskGraph.tasks).length !==
      0
    );
  }

  public complete(taskIds: string[]) {
    for (const taskId of taskIds) {
      this.completedTasks.add(taskId);
    }
    this.notScheduledTaskGraph = removeTasksFromTaskGraph(
      this.notScheduledTaskGraph,
      taskIds
    );
  }

  public nextTask() {
    if (this.scheduledTasks.length > 0) {
      return this.taskGraph.tasks[this.scheduledTasks.shift()];
    } else {
      return null;
    }
  }

  public nextBatch(): Batch {
    return this.scheduledBatches.length > 0
      ? this.scheduledBatches.shift()
      : null;
  }

  private async scheduleTask(taskId: string) {
    const task = this.taskGraph.tasks[taskId];

    if (!task.hash) {
      await hashTask(
        this.workspaces,
        this.hasher,
        this.projectGraph,
        this.taskGraph,
        task
      );
    }

    this.notScheduledTaskGraph = removeTasksFromTaskGraph(
      this.notScheduledTaskGraph,
      [taskId]
    );
    this.options.lifeCycle.scheduleTask(task);
    this.scheduledTasks.push(taskId);
  }

  private scheduleBatches() {
    const batchMap: Record<string, TaskGraph> = {};
    for (const root of this.notScheduledTaskGraph.roots) {
      const rootTask = this.notScheduledTaskGraph.tasks[root];
      const executorName = getExecutorNameForTask(
        rootTask,
        this.nxJson,
        this.projectGraph
      );
      this.processTaskForBatches(batchMap, rootTask, executorName, true);
    }
    for (const [executorName, taskGraph] of Object.entries(batchMap)) {
      this.scheduleBatch({ executorName, taskGraph });
    }
  }

  private scheduleBatch({ executorName, taskGraph }: Batch) {
    // Create a new task graph without the tasks that are being scheduled as part of this batch
    this.notScheduledTaskGraph = removeTasksFromTaskGraph(
      this.notScheduledTaskGraph,
      Object.keys(taskGraph.tasks)
    );

    this.scheduledBatches.push({ executorName, taskGraph });
  }

  private processTaskForBatches(
    batches: Record<string, TaskGraph>,
    task: Task,
    rootExecutorName: string,
    isRoot: boolean
  ) {
    const { batchImplementationFactory } = getExecutorForTask(
      task,
      this.workspaces,
      this.projectGraph,
      this.nxJson
    );
    const executorName = getExecutorNameForTask(
      task,
      this.nxJson,
      this.projectGraph
    );
    if (rootExecutorName !== executorName) {
      return;
    }

    if (!batchImplementationFactory) {
      return;
    }

    const batch = (batches[rootExecutorName] =
      batches[rootExecutorName] ??
      ({
        tasks: {},
        dependencies: {},
        roots: [],
      } as TaskGraph));

    batch.tasks[task.id] = task;
    batch.dependencies[task.id] = this.taskGraph.dependencies[task.id];
    if (isRoot) {
      batch.roots.push(task.id);
    }

    for (const dep of this.reverseTaskDeps[task.id]) {
      const depTask = this.taskGraph.tasks[dep];
      this.processTaskForBatches(batches, depTask, rootExecutorName, false);
    }
  }

  private canBeScheduled(taskId: string) {
    return this.taskGraph.dependencies[taskId].every((id) =>
      this.completedTasks.has(id)
    );
  }
}
