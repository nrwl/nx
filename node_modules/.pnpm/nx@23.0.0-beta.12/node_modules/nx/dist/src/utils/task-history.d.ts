import { NxTaskHistory, TaskRun, TaskTarget } from '../native';
export declare class TaskHistory {
    taskHistory: NxTaskHistory;
    /**
     * This function returns estimated timings per task
     * @param targets
     * @returns a map where key is task id (project:target:configuration), value is average time of historical runs
     */
    getEstimatedTaskTimings(targets: TaskTarget[]): Promise<Record<string, number>>;
    getFlakyTasks(hashes: string[]): Promise<string[]>;
    recordTaskRuns(taskRuns: TaskRun[]): Promise<void>;
}
/**
 * This function returns the singleton instance of TaskHistory
 * @returns singleton instance of TaskHistory, null if database is disabled or WASM is enabled
 */
export declare function getTaskHistory(): TaskHistory | null;
