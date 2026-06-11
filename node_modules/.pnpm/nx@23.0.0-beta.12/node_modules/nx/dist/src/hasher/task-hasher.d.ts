import { FileData, ProjectGraph, ProjectGraphProjectNode } from '../config/project-graph';
import { NxJsonConfiguration } from '../config/nx-json';
import { Task, TaskGraph } from '../config/task-graph';
import { DaemonClient } from '../daemon/client/client';
import { InputDefinition } from '../config/workspace-json-project-json';
import { HashInputs, NxWorkspaceFilesExternals } from '../native';
export { HashInputs };
/**
 * A data structure returned by the default hasher.
 */
export interface PartialHash {
    value: string;
    details: {
        [name: string]: string;
    };
    inputs: HashInputs;
}
/**
 * A data structure returned by the default hasher.
 */
export interface Hash {
    value: string;
    details: {
        command: string;
        nodes: {
            [name: string]: string;
        };
        implicitDeps?: {
            [fileName: string]: string;
        };
        runtime?: {
            [input: string]: string;
        };
    };
    inputs?: HashInputs;
}
export interface TaskHasher {
    /**
     * @deprecated use hashTask(task:Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v20
     * @param task
     */
    hashTask(task: Task): Promise<Hash>;
    /**
     * @deprecated use hashTask(task:Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv) instead. This will be removed in v20
     */
    hashTask(task: Task, taskGraph: TaskGraph): Promise<Hash>;
    hashTask(task: Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv, cwd?: string): Promise<Hash>;
    /**
     * @deprecated pass `perTaskEnvs` keyed by `task.id` instead — hashing
     * every task against one shared env produces the wrong cache key when
     * tasks have per-project/target `.env` files or custom hashers that
     * read env. Will be removed in v22.
     */
    hashTasks(tasks: Task[], taskGraph: TaskGraph, env: NodeJS.ProcessEnv, cwd?: string): Promise<Hash[]>;
    /**
     * Hash `tasks`. `perTaskEnvs` must contain an entry keyed by `task.id`
     * for every task in `tasks` — task-specific env (per-project/target
     * `.env` files, custom-hasher env reads) participates in the hash, so
     * a shared env across tasks would compute the wrong cache key when
     * tasks actually differ.
     */
    hashTasks(tasks: Task[], taskGraph: TaskGraph, perTaskEnvs: Record<string, NodeJS.ProcessEnv>, cwd?: string): Promise<Hash[]>;
}
export interface TaskHasherImpl {
    /**
     * Hash `tasks` where each task is keyed in `perTaskEnvs` by `task.id`.
     * Every task must have an entry — callers who want to hash against a
     * single shared env should construct `{ [task.id]: env }` for every
     * task.
     */
    hashTasks(tasks: Task[], taskGraph: TaskGraph, perTaskEnvs: Record<string, NodeJS.ProcessEnv>, cwd?: string, collectInputs?: boolean): Promise<PartialHash[]>;
    hashTask(task: Task, taskGraph: TaskGraph, env: NodeJS.ProcessEnv, cwd?: string, collectInputs?: boolean): Promise<PartialHash>;
}
export type Hasher = TaskHasher;
export declare class DaemonBasedTaskHasher implements TaskHasher {
    private readonly daemonClient;
    private readonly runnerOptions;
    constructor(daemonClient: DaemonClient, runnerOptions: any);
    hashTasks(tasks: Task[], taskGraph: TaskGraph, envOrPerTaskEnvs: NodeJS.ProcessEnv | Record<string, NodeJS.ProcessEnv>): Promise<Hash[]>;
    hashTask(task: Task, taskGraph?: TaskGraph, env?: NodeJS.ProcessEnv): Promise<Hash>;
}
export declare class InProcessTaskHasher implements TaskHasher {
    private readonly projectGraph;
    private readonly nxJson;
    private readonly externalRustReferences;
    private readonly options;
    private taskHasher;
    constructor(projectGraph: ProjectGraph, nxJson: NxJsonConfiguration, externalRustReferences: NxWorkspaceFilesExternals | null, options: any);
    hashTasks(tasks: Task[], taskGraph: TaskGraph, envOrPerTaskEnvs: NodeJS.ProcessEnv | Record<string, NodeJS.ProcessEnv>, cwd?: string, collectInputs?: boolean): Promise<Hash[]>;
    hashTask(task: Task, taskGraph?: TaskGraph, env?: NodeJS.ProcessEnv, cwd?: string, collectInputs?: boolean): Promise<Hash>;
    private createHashDetails;
    private hashCommand;
}
export type ExpandedSelfInput = {
    fileset: string;
} | {
    runtime: string;
} | {
    env: string;
} | {
    externalDependencies: string[];
};
export type ExpandedDepsOutput = {
    dependentTasksOutputFiles: string;
    transitive?: boolean;
};
export type ExpandedInput = ExpandedSelfInput | ExpandedDepsOutput;
export declare function getNamedInputs(nxJson: NxJsonConfiguration, project: ProjectGraphProjectNode): {
    default: {
        fileset: string;
    }[];
};
export declare function getTargetInputs(nxJson: NxJsonConfiguration, projectNode: ProjectGraphProjectNode, target: string): {
    selfInputs: string[];
    dependencyInputs: string[];
};
export declare function extractPatternsFromFileSets(inputs: readonly ExpandedInput[]): string[];
export declare function getInputs(task: Task, projectGraph: ProjectGraph, nxJson: NxJsonConfiguration): {
    selfInputs: ExpandedSelfInput[];
    depsInputs: {
        input: string;
        dependencies: true;
    }[];
    depsOutputs: ExpandedDepsOutput[];
    projectInputs: {
        input: string;
        projects: string[];
    }[];
    depsFilesets: {
        fileset: string;
        dependencies: true;
    }[];
};
export declare function splitInputsIntoSelfAndDependencies(inputs: ReadonlyArray<InputDefinition | string>, namedInputs: {
    [inputName: string]: ReadonlyArray<InputDefinition | string>;
}): {
    depsInputs: {
        input: string;
        dependencies: true;
    }[];
    projectInputs: {
        input: string;
        projects: string[];
    }[];
    selfInputs: ExpandedSelfInput[];
    depsOutputs: ExpandedDepsOutput[];
    depsFilesets: {
        fileset: string;
        dependencies: true;
    }[];
};
export declare function isSelfInput(input: ExpandedInput): input is ExpandedSelfInput;
export declare function isDepsOutput(input: ExpandedInput): input is ExpandedDepsOutput;
export declare function expandSingleProjectInputs(inputs: ReadonlyArray<InputDefinition | string>, namedInputs: {
    [inputName: string]: ReadonlyArray<InputDefinition | string>;
}): ExpandedInput[];
export declare function expandNamedInput(input: string, namedInputs: {
    [inputName: string]: ReadonlyArray<InputDefinition | string>;
}): ExpandedInput[];
export declare function filterUsingGlobPatterns(root: string, files: FileData[], patterns: string[]): FileData[];
