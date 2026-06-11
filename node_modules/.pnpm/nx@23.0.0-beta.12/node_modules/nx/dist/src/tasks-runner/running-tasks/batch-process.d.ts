import type { ChildProcess, Serializable } from 'child_process';
import type { TaskResult } from '../../config/misc-interfaces';
import { BatchResults } from '../batch/batch-messages';
export declare class BatchProcess {
    private childProcess;
    private executorName;
    private exitCallbacks;
    private batchResultsCallbacks;
    private taskResultsCallbacks;
    private outputCallbacks;
    constructor(childProcess: ChildProcess, executorName: string);
    onExit(cb: (code: number) => void): void;
    onBatchResults(cb: (results: BatchResults) => void): void;
    onTaskResults(cb: (task: string, result: TaskResult) => void): void;
    onOutput(cb: (output: string) => void): void;
    getResults(): Promise<BatchResults>;
    send(message: Serializable): void;
    kill(signal?: NodeJS.Signals): void;
}
