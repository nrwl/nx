import type { GeneratorCallback } from '../config/misc-interfaces';
import { type NxJsonConfiguration } from '../config/nx-json';
import type { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import type { ProjectConfiguration } from '../config/workspace-json-project-json';
import { type FileChange, type Tree } from '../generators/tree';
export type SyncGeneratorResult = void | {
    callback?: GeneratorCallback;
    outOfSyncMessage?: string;
    outOfSyncDetails?: string[];
};
export type SyncGenerator = (tree: Tree) => SyncGeneratorResult | Promise<SyncGeneratorResult>;
export type SyncGeneratorRunSuccessResult = {
    generatorName: string;
    changes: FileChange[];
    callback?: GeneratorCallback;
    outOfSyncMessage?: string;
    outOfSyncDetails?: string[];
};
type SerializableSimpleError = {
    message: string;
    stack: string | undefined;
    title?: string;
    bodyLines?: string[];
};
export type SyncGeneratorRunErrorResult = {
    generatorName: string;
    error: SerializableSimpleError;
};
export type SyncGeneratorRunResult = SyncGeneratorRunSuccessResult | SyncGeneratorRunErrorResult;
type FlushSyncGeneratorChangesSuccess = {
    success: true;
};
type FlushSyncGeneratorFailure = {
    generator: string;
    error: SerializableSimpleError;
};
type FlushSyncGeneratorChangesFailure = {
    generatorFailures: FlushSyncGeneratorFailure[];
    generalFailure?: SerializableSimpleError;
};
export type FlushSyncGeneratorChangesResult = FlushSyncGeneratorChangesSuccess | FlushSyncGeneratorChangesFailure;
export declare class SyncError extends Error {
    title: string;
    bodyLines?: string[];
    constructor(title: string, bodyLines?: string[]);
}
export declare function getSyncGeneratorChanges(generators: string[]): Promise<SyncGeneratorRunResult[]>;
export declare function flushSyncGeneratorChanges(results: SyncGeneratorRunResult[]): Promise<FlushSyncGeneratorChangesResult>;
export declare function collectAllRegisteredSyncGenerators(projectGraph: ProjectGraph, nxJson: NxJsonConfiguration): Promise<{
    globalGenerators: string[];
    taskGenerators: string[];
}>;
export declare function runSyncGenerator(tree: Tree, generatorSpecifier: string, projects: Record<string, ProjectConfiguration>): Promise<SyncGeneratorRunResult>;
export declare function collectEnabledTaskSyncGeneratorsFromProjectGraph(projectGraph: ProjectGraph, nxJson: NxJsonConfiguration): Set<string>;
export declare function collectEnabledTaskSyncGeneratorsFromTaskGraph(taskGraph: TaskGraph, projectGraph: ProjectGraph, nxJson: NxJsonConfiguration): Set<string>;
export declare function collectRegisteredGlobalSyncGenerators(nxJson?: NxJsonConfiguration<string[] | "*">): Set<string>;
export declare function getSyncGeneratorSuccessResultsMessageLines(results: SyncGeneratorRunResult[], logOutOfSyncDetails?: boolean): string[];
export declare function getFailedSyncGeneratorsFixMessageLines(results: SyncGeneratorRunResult[], verbose: boolean, globalGeneratorSet?: Set<string>): string[];
export declare function getFlushFailureMessageLines(result: FlushSyncGeneratorChangesFailure, verbose: boolean, globalGeneratorSet?: Set<string>): string[];
export declare function processSyncGeneratorResultErrors(results: SyncGeneratorRunResult[]): {
    failedGeneratorsCount: number;
    areAllResultsFailures: boolean;
    anySyncGeneratorsFailed: boolean;
};
export {};
