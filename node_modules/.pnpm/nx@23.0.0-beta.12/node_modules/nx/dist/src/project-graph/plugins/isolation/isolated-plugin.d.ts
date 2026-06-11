import type { PluginConfiguration } from '../../../config/nx-json';
import type { ProjectGraph } from '../../../config/project-graph';
import type { RawProjectGraphDependency } from '../../project-graph-builder';
import { LoadedNxPlugin } from '../loaded-nx-plugin';
import type { CreateDependenciesContext, CreateMetadataContext, CreateNodesContextV2, CreateNodesResult, PostTasksExecutionContext, PreTasksExecutionContext, ProjectsMetadata } from '../public-api';
import type { PluginWorkerLoadResult } from './messaging';
import { Hook, Phase } from './plugin-lifecycle-manager';
export type LoadResultPayload = Extract<PluginWorkerLoadResult['payload'], {
    success: true;
}>;
export declare class IsolatedPlugin implements LoadedNxPlugin {
    readonly index?: number;
    readonly name: string;
    readonly include?: string[];
    readonly exclude?: string[];
    readonly createNodes?: [
        filePattern: string,
        fn: (matchedFiles: string[], context: CreateNodesContextV2) => Promise<Array<readonly [plugin: string, file: string, result: CreateNodesResult]>>
    ];
    readonly createDependencies?: (context: CreateDependenciesContext) => Promise<RawProjectGraphDependency[]>;
    readonly createMetadata?: (graph: ProjectGraph, context: CreateMetadataContext) => Promise<ProjectsMetadata>;
    readonly preTasksExecution?: (context: PreTasksExecutionContext) => Promise<NodeJS.ProcessEnv>;
    readonly postTasksExecution?: (context: PostTasksExecutionContext) => Promise<void>;
    private worker;
    private socket;
    private _alive;
    private _connectPromise;
    private txId;
    private pendingCount;
    private responseHandlers;
    private readonly plugin;
    private readonly root;
    private readonly pluginPath;
    private readonly shouldRegisterTSTranspiler;
    private lifecycle;
    private exitHandler;
    /**
     * Creates and loads an isolated plugin worker.
     */
    static load(plugin: PluginConfiguration, root: string, index?: number): Promise<IsolatedPlugin>;
    private constructor();
    private spawnAndConnect;
    /**
     * Ensures the worker is alive, restarting it if necessary.
     * Called before each hook execution to handle plugins that were
     * eagerly shutdown (e.g., post-task-only plugins).
     *
     * Uses a stored promise to coalesce concurrent restart attempts
     * so that only one worker is ever spawned at a time.
     */
    private ensureAlive;
    private handleSocketData;
    private sendLoadMessage;
    private setupHooks;
    private generateTxId;
    private sendRequest;
    private shutdownIfInactive;
    setWorkerEnv(env: Record<string, string>): Promise<void>;
    notifyPhaseAborted(phase: Phase, lastCompletedHook: Hook): void;
    shutdown(): void;
    private registerProcessMetrics;
}
