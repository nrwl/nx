import type { LifeCycle } from '../life-cycle';
import { TaskStatus } from '../tasks-runner';
export declare class EmptyTerminalOutputLifeCycle implements LifeCycle {
    printTaskTerminalOutput(task: any, cacheStatus: TaskStatus, terminalOutput: string): void;
}
