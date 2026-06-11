import { Task } from '../../config/task-graph';
import { LifeCycle, TaskResult } from '../life-cycle';
export declare class LegacyTaskHistoryLifeCycle implements LifeCycle {
    private startTimings;
    private pendingResults;
    private flakyTasks;
    startTasks(tasks: Task[]): void;
    endTasks(taskResults: TaskResult[]): Promise<void>;
    endCommand(): Promise<void>;
    printFlakyTasksMessage(): void;
}
