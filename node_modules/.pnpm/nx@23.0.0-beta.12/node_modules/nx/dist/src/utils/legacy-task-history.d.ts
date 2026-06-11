declare const taskRunKeys: readonly ["project", "target", "configuration", "hash", "code", "status", "start", "end"];
export type TaskRun = Record<(typeof taskRunKeys)[number], string>;
export declare function getHistoryForHashes(hashes: string[]): Promise<{
    [hash: string]: TaskRun[];
}>;
export declare function writeTaskRunsToHistory(taskRuns: TaskRun[]): Promise<void>;
export declare const taskHistoryFile: string;
export {};
