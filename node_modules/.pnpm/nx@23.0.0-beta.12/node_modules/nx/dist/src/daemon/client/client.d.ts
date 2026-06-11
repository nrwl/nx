import { ChildProcess } from 'child_process';
import { FileData, ProjectGraph } from '../../config/project-graph';
import { Task, TaskGraph } from '../../config/task-graph';
import { Hash } from '../../hasher/task-hasher';
import { NxWorkspaceFiles, TaskRun, TaskTarget } from '../../native';
import { PostTasksExecutionContext, PreTasksExecutionContext } from '../../project-graph/plugins/public-api';
import { ConfigurationSourceMaps } from '../../project-graph/utils/project-configuration/source-maps';
import type { FlushSyncGeneratorChangesResult, SyncGeneratorRunResult } from '../../utils/sync-generators';
import { type ConfigureAiAgentsStatusResponse } from '../message-types/configure-ai-agents';
import { type NxConsoleStatusResponse, type SetNxConsolePreferenceAndInstallResponse } from '../message-types/nx-console';
export type UnregisterCallback = () => void;
export type ChangedFile = {
    path: string;
    type: 'create' | 'update' | 'delete';
};
export declare class DaemonClient {
    private readonly nxJson;
    constructor();
    private queue;
    private socketMessenger;
    private currentMessage;
    private currentResolve;
    private currentReject;
    private currentSpinner;
    private _enabled;
    private _daemonStatus;
    private _waitForDaemonReady;
    private _daemonReady;
    private _out;
    private _err;
    private fileWatcherMessenger;
    private fileWatcherReconnecting;
    private fileWatcherCallbacks;
    private fileWatcherConfigs;
    private projectGraphListenerMessenger;
    private projectGraphListenerReconnecting;
    private projectGraphListenerCallbacks;
    enabled(): boolean;
    reset(): void;
    private getSocketPath;
    requestShutdown(): Promise<void>;
    getProjectGraphAndSourceMaps(): Promise<{
        projectGraph: ProjectGraph;
        sourceMaps: ConfigurationSourceMaps;
    }>;
    getAllFileData(): Promise<FileData[]>;
    hashTasks(runnerOptions: any, tasks: Task[], taskGraph: TaskGraph, perTaskEnvs: Record<string, NodeJS.ProcessEnv>, cwd: string, collectInputs?: boolean): Promise<Hash[]>;
    registerFileWatcher(config: {
        watchProjects: string[] | 'all';
        includeGlobalWorkspaceFiles?: boolean;
        includeDependentProjects?: boolean;
        allowPartialGraph?: boolean;
    }, callback: (error: Error | null | 'reconnecting' | 'reconnected' | 'closed', data: {
        changedProjects: string[];
        changedFiles: ChangedFile[];
    } | null) => void): Promise<UnregisterCallback>;
    private reconnectFileWatcher;
    registerProjectGraphRecomputationListener(callback: (error: Error | null | 'reconnecting' | 'reconnected' | 'closed', data: {
        projectGraph: ProjectGraph;
        sourceMaps: ConfigurationSourceMaps;
        error: Error | null;
    } | null) => void): Promise<UnregisterCallback>;
    private reconnectProjectGraphListener;
    processInBackground(requirePath: string, data: any): Promise<any>;
    recordOutputsHashBatch(entries: {
        outputs: string[];
        hash: string;
    }[]): Promise<any>;
    outputsHashesMatchBatch(entries: {
        outputs: string[];
        hash: string;
    }[]): Promise<boolean[]>;
    glob(globs: string[], exclude?: string[]): Promise<string[]>;
    multiGlob(globs: string[], exclude?: string[]): Promise<string[][]>;
    getWorkspaceContextFileData(): Promise<FileData[]>;
    getWorkspaceFiles(projectRootMap: Record<string, string>): Promise<NxWorkspaceFiles>;
    getFilesInDirectory(dir: string): Promise<string[]>;
    hashGlob(globs: string[], exclude?: string[]): Promise<string>;
    hashMultiGlob(globGroups: string[][]): Promise<string[]>;
    getFlakyTasks(hashes: string[]): Promise<string[]>;
    getEstimatedTaskTimings(targets: TaskTarget[]): Promise<Record<string, number>>;
    recordTaskRuns(taskRuns: TaskRun[]): Promise<void>;
    getSyncGeneratorChanges(generators: string[]): Promise<SyncGeneratorRunResult[]>;
    flushSyncGeneratorChangesToDisk(generators: string[]): Promise<FlushSyncGeneratorChangesResult>;
    getRegisteredSyncGenerators(): Promise<{
        globalGenerators: string[];
        taskGenerators: string[];
    }>;
    updateWorkspaceContext(createdFiles: string[], updatedFiles: string[], deletedFiles: string[]): Promise<void>;
    runPreTasksExecution(context: PreTasksExecutionContext): Promise<NodeJS.ProcessEnv[]>;
    runPostTasksExecution(context: PostTasksExecutionContext): Promise<void>;
    getNxConsoleStatus(): Promise<NxConsoleStatusResponse>;
    setNxConsolePreferenceAndInstall(preference: boolean): Promise<SetNxConsolePreferenceAndInstallResponse>;
    getConfigureAiAgentsStatus(): Promise<ConfigureAiAgentsStatusResponse>;
    resetConfigureAiAgentsStatus(): Promise<{
        success: boolean;
    }>;
    isServerAvailable(): Promise<boolean>;
    private startDaemonIfNecessary;
    private sendToDaemonViaQueue;
    private setUpConnection;
    private handleConnectionError;
    private establishConnection;
    /**
     * Wait for daemon server to be available.
     * Used for reconnection - throws VersionMismatchError if daemon version differs.
     */
    private waitForServerToBeAvailable;
    private envReflectionSent;
    private sendMessageToDaemon;
    private registerDaemonProcessWithMetricsService;
    private handleMessage;
    startInBackground(): Promise<ChildProcess['pid']>;
    stop(): Promise<void>;
}
export declare const daemonClient: DaemonClient;
export declare function isDaemonEnabled(): boolean;
