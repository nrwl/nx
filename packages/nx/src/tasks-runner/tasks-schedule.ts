import {
  calculateReverseDeps,
  getExecutorForTask,
  getExecutorNameForTask,
  removeTasksFromTaskGraph,
} from './utils';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { Task, TaskGraph } from '../config/task-graph';
import { ProjectGraph } from '../config/project-graph';
import { findAllProjectNodeDependencies } from '../utils/project-graph-utils';
import { reverse } from '../project-graph/operators';

export interface Batch {
  executorName: string;
  taskGraph: TaskGraph;
}

export class TasksSchedule {
  private notScheduledTaskGraph = this.taskGraph;
  private reverseTaskDeps = calculateReverseDeps(this.taskGraph);
  private reverseProjectGraph = reverse(this.projectGraph);
  private scheduledBatches: Batch[] = [];
  private scheduledTasks: string[] = [];
  private completedTasks = new Set<string>();
  private scheduleRequestsExecutionChain = Promise.resolve();

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly taskGraph: TaskGraph,
    private readonly options: DefaultTasksRunnerOptions
  ) {}

  public async scheduleNextTasks() {
    this.scheduleRequestsExecutionChain =
      this.scheduleRequestsExecutionChain.then(() => this.scheduleTasks());
    await this.scheduleRequestsExecutionChain;
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

  public getAllScheduledTasks() {
    return {
      scheduledTasks: this.scheduledTasks,
      scheduledBatches: this.scheduledBatches,
    };
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

  private async scheduleTasks() {
    if (this.options.batch || process.env.NX_BATCH_MODE === 'true') {
      await this.scheduleBatches();
    }
    for (let root of this.notScheduledTaskGraph.roots) {
      if (this.canBeScheduled(root)) {
        await this.scheduleTask(root);
      }
    }
  }

  private async scheduleTask(taskId: string) {
    this.notScheduledTaskGraph = removeTasksFromTaskGraph(
      this.notScheduledTaskGraph,
      [taskId]
    );
    this.scheduledTasks = this.scheduledTasks
      .concat(taskId)
      // NOTE: sort task by most dependent on first
      .sort((taskId1, taskId2) => {
        // First compare the length of task dependencies.
        const taskDifference =
          this.reverseTaskDeps[taskId2].length -
          this.reverseTaskDeps[taskId1].length;

        if (taskDifference !== 0) {
          return taskDifference;
        }

        // Tie-breaker for tasks with equal number of task dependencies.
        // Most likely tasks with no dependencies such as test
        const project1 = this.taskGraph.tasks[taskId1].target.project;
        const project2 = this.taskGraph.tasks[taskId2].target.project;

        return (
          findAllProjectNodeDependencies(project2, this.reverseProjectGraph)
            .length -
          findAllProjectNodeDependencies(project1, this.reverseProjectGraph)
            .length
        );
      });
  }

  private async scheduleBatches() {
    const batchMap: Record<string, TaskGraph> = {};
    for (const root of this.notScheduledTaskGraph.roots) {
      const rootTask = this.notScheduledTaskGraph.tasks[root];
      const executorName = getExecutorNameForTask(rootTask, this.projectGraph);
      await this.processTaskForBatches(batchMap, rootTask, executorName, true);
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

  private async processTaskForBatches(
    batches: Record<string, TaskGraph>,
    task: Task,
    rootExecutorName: string,
    isRoot: boolean
  ) {
    if (!this.canBatchTaskBeScheduled(task.id, batches[rootExecutorName])) {
      return;
    }

    const { batchImplementationFactory } = getExecutorForTask(
      task,
      this.projectGraph
    );
    const executorName = getExecutorNameForTask(task, this.projectGraph);
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
    batch.dependencies[task.id] =
      this.notScheduledTaskGraph.dependencies[task.id];
    if (isRoot) {
      batch.roots.push(task.id);
    }

    for (const dep of this.reverseTaskDeps[task.id]) {
      const depTask = this.taskGraph.tasks[dep];
      await this.processTaskForBatches(
        batches,
        depTask,
        rootExecutorName,
        false
      );
    }
  }

  private canBatchTaskBeScheduled(
    taskId: string,
    batchTaskGraph: TaskGraph | undefined
  ): boolean {
    // all deps have either completed or belong to the same batch
    return this.taskGraph.dependencies[taskId].every(
      (id) => this.completedTasks.has(id) || !!batchTaskGraph?.tasks[id]
    );
  }

  private canBeScheduled(taskId: string) {
    return this.taskGraph.dependencies[taskId].every((id) =>
      this.completedTasks.has(id)
    );
  }
}
