import { Serializable } from 'child_process';
import { ExecutorContext } from '../../config/misc-interfaces';
import { PseudoTtyProcess } from '../../tasks-runner/pseudo-terminal';
import { RunningTask } from '../../tasks-runner/running-tasks/running-task';
import { NormalizedRunCommandsOptions } from './run-commands.impl';
export declare class ParallelRunningTasks implements RunningTask {
    private readonly childProcesses;
    private readyWhenStatus;
    private readonly streamOutput;
    private exitCallbacks;
    private outputCallbacks;
    constructor(options: NormalizedRunCommandsOptions, context: ExecutorContext, taskId: string);
    getResults(): Promise<{
        code: number;
        terminalOutput: string;
    }>;
    onOutput(cb: (terminalOutput: string) => void): void;
    onExit(cb: (code: number, terminalOutput: string) => void): void;
    send(message: Serializable): void;
    kill(signal?: NodeJS.Signals): Promise<void>;
    private run;
    private terminateRemainingProcesses;
}
export declare class SeriallyRunningTasks implements RunningTask {
    private readonly tuiEnabled;
    private readonly taskId;
    private terminalOutputChunks;
    private currentProcess;
    private exitCallbacks;
    private code;
    private error;
    private outputCallbacks;
    constructor(options: NormalizedRunCommandsOptions, context: ExecutorContext, tuiEnabled: boolean, taskId: string);
    getResults(): Promise<{
        code: number;
        terminalOutput: string;
    }>;
    onExit(cb: (code: number, terminalOutput: string) => void): void;
    onOutput(cb: (terminalOutput: string) => void): void;
    send(message: Serializable): void;
    kill(signal?: NodeJS.Signals): void | Promise<void>;
    private run;
    private createProcess;
}
export declare function runSingleCommandWithPseudoTerminal(normalized: NormalizedRunCommandsOptions, context: ExecutorContext, taskId: string): Promise<PseudoTtyProcess>;
