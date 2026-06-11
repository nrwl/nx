import { CloudTaskRunnerOptions } from '../nx-cloud-tasks-runner-shell';
export declare class UnknownCommandError extends Error {
    command: string;
    availableCommands: string[];
    constructor(command: string, availableCommands: string[]);
}
export declare function getCloudClient(options: CloudTaskRunnerOptions): Promise<{
    invoke: (command: string, exit?: boolean) => void;
    availableCommands: string[];
}>;
