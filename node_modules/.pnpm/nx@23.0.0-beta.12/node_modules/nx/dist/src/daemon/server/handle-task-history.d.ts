import type { TaskRun, TaskTarget } from '../../native';
export declare function handleRecordTaskRuns(taskRuns: TaskRun[]): Promise<{
    response: string;
    description: string;
}>;
export declare function handleGetFlakyTasks(hashes: string[]): Promise<{
    response: string[];
    description: string;
}>;
export declare function handleGetEstimatedTaskTimings(targets: TaskTarget[]): Promise<{
    response: Record<string, number>;
    description: string;
}>;
