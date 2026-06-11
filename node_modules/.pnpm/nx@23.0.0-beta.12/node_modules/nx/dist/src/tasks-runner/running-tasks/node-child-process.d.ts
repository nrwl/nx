import type { ChildProcess, Serializable } from 'child_process';
import type { RunningTask } from './running-task';
export declare class NodeChildProcessWithNonDirectOutput implements RunningTask {
    private childProcess;
    private terminalOutputChunks;
    private joinedTerminalOutput;
    private exitCallbacks;
    private outputCallbacks;
    private exitCode;
    constructor(childProcess: ChildProcess, { streamOutput, prefix }: {
        streamOutput: boolean;
        prefix: string;
    });
    onExit(cb: (code: number, terminalOutput: string) => void): void;
    onOutput(cb: (output: string) => void): void;
    getResults(): Promise<{
        code: number;
        terminalOutput: string;
    }>;
    send(message: Serializable): void;
    kill(signal?: NodeJS.Signals): void;
}
export declare class NodeChildProcessWithDirectOutput implements RunningTask {
    private childProcess;
    private temporaryOutputPath;
    private terminalOutput;
    private exitCallbacks;
    private exited;
    private exitCode;
    constructor(childProcess: ChildProcess, temporaryOutputPath: string);
    send(message: Serializable): void;
    onExit(cb: (code: number, signal: NodeJS.Signals) => void): void;
    getResults(): Promise<{
        code: number;
        terminalOutput: string;
    }>;
    waitForExit(): Promise<void>;
    getTerminalOutput(): string;
    kill(signal?: NodeJS.Signals): void;
}
