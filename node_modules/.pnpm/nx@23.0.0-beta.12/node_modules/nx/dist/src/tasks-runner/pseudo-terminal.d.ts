import { Serializable } from 'child_process';
import { ChildProcess, RustPseudoTerminal } from '../native';
import { PseudoIPCServer } from './pseudo-ipc';
import { RunningTask } from './running-tasks/running-task';
export declare function createPseudoTerminal(skipSupportCheck?: boolean): PseudoTerminal;
export declare class PseudoTerminal {
    private rustPseudoTerminal;
    private pseudoIPCPath;
    private pseudoIPC;
    private initialized;
    private childProcesses;
    static isSupported(): boolean;
    constructor(rustPseudoTerminal: RustPseudoTerminal);
    init(): Promise<void>;
    shutdown(code: number): void;
    runCommand(command: string, { cwd, execArgv, jsEnv, quiet, tty, }?: {
        cwd?: string;
        execArgv?: string[];
        jsEnv?: Record<string, string>;
        quiet?: boolean;
        tty?: boolean;
    }): PseudoTtyProcess;
    fork(id: string, script: string, { cwd, execArgv, jsEnv, quiet, commandLabel, }: {
        cwd?: string;
        execArgv?: string[];
        jsEnv?: Record<string, string>;
        quiet?: boolean;
        commandLabel?: string;
    }): Promise<PseudoTtyProcessWithSend>;
    sendMessageToChildren(message: Serializable): void;
    onMessageFromChildren(callback: (message: Serializable) => void): void;
}
export declare class PseudoTtyProcess implements RunningTask {
    rustPseudoTerminal: RustPseudoTerminal;
    private childProcess;
    isAlive: boolean;
    private exitCallbacks;
    private outputCallbacks;
    private terminalOutputChunks;
    constructor(rustPseudoTerminal: RustPseudoTerminal, childProcess: ChildProcess);
    getResults(): Promise<{
        code: number;
        terminalOutput: string;
    }>;
    onExit(callback: (code: number, terminalOutput: string) => void): void;
    onOutput(callback: (message: string) => void): void;
    getPid(): number | undefined;
    kill(s?: NodeJS.Signals): void;
    getParserAndWriter(): import("../native").ExternalObject<[import("../native").ParserArc, import("../native").WriterArc]>;
}
export declare class PseudoTtyProcessWithSend extends PseudoTtyProcess {
    rustPseudoTerminal: RustPseudoTerminal;
    private id;
    private pseudoIpc;
    constructor(rustPseudoTerminal: RustPseudoTerminal, _childProcess: ChildProcess, id: string, pseudoIpc: PseudoIPCServer);
    send(message: Serializable): void;
}
