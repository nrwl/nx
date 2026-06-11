import { LifeCycle, TaskResult } from '../../tasks-runner/life-cycle';
import { Task } from '../../config/task-graph';
export declare class StoreRunInformationLifeCycle implements LifeCycle {
    private readonly command;
    private readonly storeFile;
    private readonly now;
    private startTime;
    private timings;
    private taskResults;
    constructor(command?: string, storeFile?: typeof storeFileFunction, now?: () => string);
    startTasks(tasks: Task[]): void;
    endTasks(taskResults: TaskResult[]): void;
    startCommand(): void;
    endCommand(): any;
}
declare function storeFileFunction(runDetails: any): void;
export {};
