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
export declare class StaticRunOneTerminalOutputLifeCycle implements LifeCycle {
    private readonly initiatingProject;
    private readonly projectNames;
    private readonly tasks;
    private readonly args;
    failedTasks: Task[];
    cachedTasks: Task[];
    constructor(initiatingProject: string, projectNames: string[], tasks: Task[], args: {
        targets?: string[];
        configuration?: string;
        verbose?: boolean;
    });
    startCommand(): void;
    endCommand(): void;
    endTasks(taskResults: TaskResult[]): void;
    printTaskTerminalOutput(task: Task, status: TaskStatus, terminalOutput: string): void;
}
