import type { ProjectGraph } from '../../config/project-graph';
import { type PluginConfiguration } from '../../config/nx-json';
import type { RawProjectGraphDependency } from '../project-graph-builder';
import type { CreateDependenciesContext, CreateMetadataContext, CreateNodesContextV2, CreateNodesResult, NxPluginV2, PostTasksExecutionContext, PreTasksExecutionContext, ProjectsMetadata } from './public-api';
/**
 * NOTE: Avoid using `import type` with this class. It causes issues with
 * jest's module resolution when running tests in projects that import
 * the devkit-internals
 */
export declare class LoadedNxPlugin {
    readonly index?: number;
    readonly name: string;
    readonly createNodes?: [
        filePattern: string,
        fn: (matchedFiles: string[], context: CreateNodesContextV2) => Promise<Array<readonly [plugin: string, file: string, result: CreateNodesResult]>>
    ];
    readonly createDependencies?: (context: CreateDependenciesContext) => Promise<RawProjectGraphDependency[]>;
    readonly createMetadata?: (graph: ProjectGraph, context: CreateMetadataContext) => Promise<ProjectsMetadata>;
    readonly preTasksExecution?: (context: PreTasksExecutionContext) => Promise<NodeJS.ProcessEnv>;
    readonly postTasksExecution?: (context: PostTasksExecutionContext) => Promise<void>;
    readonly options?: unknown;
    readonly include?: string[];
    readonly exclude?: string[];
    /**
     * Notifies the plugin that a phase was aborted mid-flight.
     * Overridden by IsolatedPlugin to reset lifecycle phase tracking so
     * the worker can still shut down properly.
     *
     * @param phase The phase that was aborted (e.g. 'graph').
     * @param lastCompletedHook The last hook that was called before the
     *   abort (e.g. 'createNodes').
     */
    notifyPhaseAborted?(phase: string, lastCompletedHook: string): void;
    /**
     * Forwards updated environment variables to the plugin worker process.
     * Only meaningful for isolated plugins; in-process plugins share the
     * daemon's process.env automatically.
     */
    setWorkerEnv?(env: Record<string, string>): Promise<void>;
    constructor(plugin: NxPluginV2, pluginDefinition: PluginConfiguration, index?: number);
}
