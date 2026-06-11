import { ChangedFile } from '../../daemon/client/client';
export interface WatchArguments {
    projects?: string[];
    all?: boolean;
    includeDependentProjects?: boolean;
    includeGlobalWorkspaceFiles?: boolean;
    verbose?: boolean;
    command?: string;
    initialRun?: boolean;
    projectNameEnvName?: string;
    fileChangesEnvName?: string;
}
export declare class BatchFunctionRunner {
    private callback;
    private running;
    private pendingProjects;
    private pendingFiles;
    protected get _verbose(): boolean;
    private get hasPending();
    constructor(callback: (projects: Set<string>, files: Set<string>) => Promise<unknown>);
    enqueue(projectNames: string[], fileChanges: ChangedFile[]): Promise<void>;
    private process;
}
export declare function watch(args: WatchArguments): Promise<void>;
