import { type ExecOptions, type ExecSyncOptions } from 'child_process';
import { PackageManagerCommands } from './package-manager';
import { ChildProcess } from '../native';
export declare function getRunNxBaseCommand(packageManagerCommand?: PackageManagerCommands, cwd?: string): string;
export declare function runNxSync(cmd: string, options?: ExecSyncOptions & {
    cwd?: string;
    packageManagerCommand?: PackageManagerCommands;
}): void;
export declare function runNxAsync(cmd: string, options?: ExecOptions & {
    cwd?: string;
    silent?: boolean;
    packageManagerCommand?: PackageManagerCommands;
}): Promise<void>;
export declare class PseudoTtyProcess {
    private childProcess;
    isAlive: boolean;
    exitCallbacks: any[];
    constructor(childProcess: ChildProcess);
    onExit(callback: (code: number) => void): void;
    onOutput(callback: (message: string) => void): void;
    kill(): void;
}
