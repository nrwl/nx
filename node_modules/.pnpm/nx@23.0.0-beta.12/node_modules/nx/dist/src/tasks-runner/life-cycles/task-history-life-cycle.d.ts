import { Task } from '../../config/task-graph';
import { LifeCycle, TaskResult } from '../life-cycle';
import { LegacyTaskHistoryLifeCycle } from './task-history-life-cycle-old';
export declare function getTasksHistoryLifeCycle(): TaskHistoryLifeCycle | LegacyTaskHistoryLifeCycle;
export declare class TaskHistoryLifeCycle implements LifeCycle {
    private startTimings;
    private pendingResults;
    private taskRuns;
    private taskHistory;
    private flakyTasks;
    constructor();
    startTasks(tasks: Task[]): void;
    endTasks(taskResults: TaskResult[]): Promise<void>;
    endCommand(): Promise<void>;
    printFlakyTasksMessage(): void;
}
