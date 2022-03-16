import { Workspaces } from 'nx/src/shared/workspace';

import {
  calculateReverseDeps,
  getCustomHasher,
  getExecutorForTask,
  getExecutorNameForTask,
  removeTasksFromTaskGraph,
} from './utils';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { Hasher } from 'nx/src/core/hasher/hasher';
import { Task, TaskGraph } from '../shared/tasks';
import { ProjectGraph } from 'nx/src/shared/project-graph';

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
    await this.hashTask(task);

    this.notScheduledTaskGraph = removeTasksFromTaskGraph(
      this.notScheduledTaskGraph,
      [taskId]
    );
    this.scheduledTasks.push(taskId);
    // TODO vsavkin: remove the if statement after Nx 14 is out
    if (this.options.lifeCycle.scheduleTask) {
      this.options.lifeCycle.scheduleTask(task);
    }
  }

  private scheduleBatches() {
    const batchMap: Record<string, TaskGraph> = {};
    for (const root of this.notScheduledTaskGraph.roots) {
      const rootTask = this.notScheduledTaskGraph.tasks[root];
      const executorName = getExecutorNameForTask(rootTask, this.workspaces);
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
      this.workspaces
    );
    const executorName = getExecutorNameForTask(task, this.workspaces);
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

  private async hashTask(task: Task) {
    const customHasher = getCustomHasher(task, this.workspaces);
    const { value, details } = await (customHasher
      ? customHasher(task, {
          hasher: this.hasher,
          projectGraph: this.projectGraph,
          taskGraph: this.taskGraph,
          workspaceConfig: this.workspaces.readWorkspaceConfiguration(),
        })
      : this.hasher.hashTaskWithDepsAndContext(task));
    task.hash = value;
    task.hashDetails = details;
  }
}
