import { TaskStatus } from '../tasks-runner';
import type { LifeCycle, TaskResult } from '../life-cycle';
import { Task } from '../../config/task-graph';
/**
 * The following life cycle's outputs are static, meaning no previous content
 * is rewritten or modified as new outputs are added. It is therefore intended
 * for use in CI environments.
 *
 * For the common case of a user executing a command on their local machine,
 * the dynamic equivalent of this life cycle is usually preferable.
 */
export declare class StaticRunManyTerminalOutputLifeCycle implements LifeCycle {
    private readonly projectNames;
    private readonly tasks;
    private readonly args;
    private readonly taskOverrides;
    failedTasks: Task[];
    cachedTasks: Task[];
    allCompletedTasks: Map<string, Task>;
    constructor(projectNames: string[], tasks: Task[], args: {
        targets?: string[];
        configuration?: string;
    }, taskOverrides: any);
    startCommand(): void;
    endCommand(): void;
    private skippedTasks;
    endTasks(taskResults: TaskResult[]): void;
    printTaskTerminalOutput(task: Task, cacheStatus: TaskStatus, terminalOutput: string): void;
}
