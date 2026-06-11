import type { TaskRun, TaskTarget } from '../../native';
export declare const GET_FLAKY_TASKS: "GET_FLAKY_TASKS";
export declare const GET_ESTIMATED_TASK_TIMINGS: "GET_ESTIMATED_TASK_TIMINGS";
export declare const RECORD_TASK_RUNS: "RECORD_TASK_RUNS";
export type HandleGetFlakyTasks = {
    type: typeof GET_FLAKY_TASKS;
    hashes: string[];
};
export type HandleGetEstimatedTaskTimings = {
    type: typeof GET_ESTIMATED_TASK_TIMINGS;
    targets: TaskTarget[];
};
export type HandleRecordTaskRunsMessage = {
    type: typeof RECORD_TASK_RUNS;
    taskRuns: TaskRun[];
};
export declare function isHandleGetFlakyTasksMessage(message: unknown): message is HandleGetFlakyTasks;
export declare function isHandleGetEstimatedTaskTimings(message: unknown): message is HandleGetEstimatedTaskTimings;
export declare function isHandleWriteTaskRunsToHistoryMessage(message: unknown): message is HandleRecordTaskRunsMessage;
