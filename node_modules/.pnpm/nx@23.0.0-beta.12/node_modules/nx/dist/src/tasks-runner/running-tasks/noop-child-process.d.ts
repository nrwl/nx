import { RunningTask } from './running-task';
export declare class NoopChildProcess implements RunningTask {
    private results;
    constructor(results: {
        code: number;
        terminalOutput: string;
    });
    send(): void;
    getResults(): Promise<{
        code: number;
        terminalOutput: string;
    }>;
    kill(): void;
    onExit(cb: (code: number, terminalOutput: string) => void): void;
    onOutput(cb: (terminalOutput: string) => void): void;
}
