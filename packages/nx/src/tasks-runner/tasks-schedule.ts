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
import { TaskHistory, getTaskHistory } from '../utils/task-history';

export interface Batch {
  executorName: string;
  taskGraph: TaskGraph;
}

export class TasksSchedule {
  private notScheduledTaskGraph = this.taskGraph;
  private reverseTaskDeps = calculateReverseDeps(this.taskGraph);
  private reverseProjectGraph = reverse(this.projectGraph);
  private taskHistory: TaskHistory | null = getTaskHistory();

  private scheduledBatches: Batch[] = [];
  private scheduledTasks: string[] = [];
  private runningTasks = new Set<string>();
  private completedTasks = new Set<string>();
  private scheduleRequestsExecutionChain = Promise.resolve();
  private estimatedTaskTimings: Record<string, number> = {};
  private projectDependencies: Record<string, number> = {};

  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly taskGraph: TaskGraph,
    private readonly options: DefaultTasksRunnerOptions
  ) {}

  public async init() {
    if (this.taskHistory) {
      this.estimatedTaskTimings =
        await this.taskHistory.getEstimatedTaskTimings(
          Object.values(this.taskGraph.tasks).map((t) => t.target)
        );
    }

    for (const project of Object.values(this.taskGraph.tasks).map(
      (t) => t.target.project
    )) {
      this.projectDependencies[project] ??= findAllProjectNodeDependencies(
        project,
        this.reverseProjectGraph
      ).length;
    }
  }

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
      this.runningTasks.delete(taskId);
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

        const project1NodeDependencies = this.projectDependencies[project1];
        const project2NodeDependencies = this.projectDependencies[project2];

        const dependenciesDiff =
          project2NodeDependencies - project1NodeDependencies;

        if (dependenciesDiff !== 0) {
          return dependenciesDiff;
        }

        const task1Timing: number | undefined =
          this.estimatedTaskTimings[taskId1];
        if (!task1Timing) {
          // if no timing or 0, put task1 at beginning
          return -1;
        }
        const task2Timing: number | undefined =
          this.estimatedTaskTimings[taskId2];
        if (!task2Timing) {
          // if no timing or 0, put task2 at beginning
          return 1;
        }
        return task2Timing - task1Timing;
      });
    this.runningTasks.add(taskId);
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
  ): Promise<void> {
    if (!this.canBatchTaskBeScheduled(task, batches[rootExecutorName])) {
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
    task: Task,
    batchTaskGraph: TaskGraph | undefined
  ): boolean {
    // task self needs to have parallelism true
    // all deps have either completed or belong to the same batch
    return (
      task.parallelism === true &&
      this.taskGraph.dependencies[task.id].every(
        (id) => this.completedTasks.has(id) || !!batchTaskGraph?.tasks[id]
      )
    );
  }

  private canBeScheduled(taskId: string): boolean {
    const hasDependenciesCompleted = this.taskGraph.dependencies[taskId].every(
      (id) => this.completedTasks.has(id)
    );

    // if dependencies have not completed, cannot schedule
    if (!hasDependenciesCompleted) {
      return false;
    }

    // if there are no running tasks, can schedule anything
    if (this.runningTasks.size === 0) {
      return true;
    }

    const runningTasksNotSupportParallelism = Array.from(
      this.runningTasks
    ).some((taskId) => {
      return this.taskGraph.tasks[taskId].parallelism === false;
    });
    if (runningTasksNotSupportParallelism) {
      // if any running tasks do not support parallelism, no other tasks can be scheduled
      return false;
    } else {
      // if all running tasks support parallelism, can only schedule task with parallelism
      return this.taskGraph.tasks[taskId].parallelism === true;
    }
  }
}
