import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { Task, TaskGraph } from '../config/task-graph';
import { ProjectGraph } from '../config/project-graph';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
export interface Batch {
    id: string;
    executorName: string;
    taskGraph: TaskGraph;
}
export declare class TasksSchedule {
    private readonly projectGraph;
    private readonly projects;
    private readonly taskGraph;
    private readonly options;
    private notScheduledTaskGraph;
    private reverseTaskDeps;
    private reverseProjectGraph;
    private taskHistory;
    private scheduledBatches;
    private scheduledTasks;
    private runningTasks;
    private completedTasks;
    private scheduleRequestsExecutionChain;
    private estimatedTaskTimings;
    private projectDependencies;
    private batchCounters;
    constructor(projectGraph: ProjectGraph, projects: Record<string, ProjectConfiguration>, taskGraph: TaskGraph, options: DefaultTasksRunnerOptions);
    init(): Promise<void>;
    scheduleNextTasks(): Promise<void>;
    hasTasks(): boolean;
    complete(taskIds: string[]): void;
    getAllScheduledTasks(): {
        scheduledTasks: string[];
        scheduledBatches: Batch[];
    };
    nextTask(filter?: (task: Task) => boolean): Task;
    nextBatch(): Batch;
    getIncompleteTasks(): Task[];
    private scheduleTasks;
    private scheduleTaskBatch;
    private sortScheduledTasks;
    private scheduleBatches;
    private scheduleBatch;
    private processTaskForBatches;
    private canBatchTaskBeScheduled;
    private canBeScheduled;
    getEstimatedTaskTimings(): Record<string, number>;
}
