import type { LifeCycle, TaskResult } from '../life-cycle';
export declare class TaskResultsLifeCycle implements LifeCycle {
    private taskResults;
    endTasks(taskResults: TaskResult[]): void;
    getTaskResults(): Record<string, TaskResult>;
}
