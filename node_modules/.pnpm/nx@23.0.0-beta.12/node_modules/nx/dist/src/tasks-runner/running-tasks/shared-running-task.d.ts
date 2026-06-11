import { RunningTask } from './running-task';
import { RunningTasksService } from '../../native';
export declare class SharedRunningTask implements RunningTask {
    private runningTasksService;
    private exitCallbacks;
    constructor(runningTasksService: RunningTasksService, taskId: string);
    getResults(): Promise<{
        code: number;
        terminalOutput: string;
    }>;
    kill(): void;
    onExit(cb: (code: number) => void): void;
    private waitForTaskToFinish;
}
