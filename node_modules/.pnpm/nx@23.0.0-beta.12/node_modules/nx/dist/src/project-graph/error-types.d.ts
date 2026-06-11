import { ConfigurationResult } from './utils/project-configuration-utils';
import type { ConfigurationSourceMaps } from './utils/project-configuration/source-maps';
import { ProjectConfiguration } from '../config/workspace-json-project-json';
import { ProjectGraph } from '../config/project-graph';
import { CreateNodesFunctionV2 } from './plugins/public-api';
export type ProjectGraphErrorTypes = AggregateCreateNodesError | MergeNodesError | CreateMetadataError | ProjectsWithNoNameError | MultipleProjectsWithSameNameError | ProcessDependenciesError | WorkspaceValidityError;
export declare class StaleProjectGraphCacheError extends Error {
    constructor();
}
export declare class ProjectGraphError extends Error {
    #private;
    private readonly errors;
    constructor(errors: Array<ProjectGraphErrorTypes>, partialProjectGraph: ProjectGraph, partialSourceMaps: ConfigurationSourceMaps | null);
    /**
     * The daemon cannot throw errors which contain methods as they are not serializable.
     *
     * This method creates a new {@link ProjectGraphError} from a {@link DaemonProjectGraphError} with the methods based on the same serialized data.
     */
    static fromDaemonProjectGraphError(e: DaemonProjectGraphError): ProjectGraphError;
    /**
     * This gets the partial project graph despite the errors which occured.
     * This partial project graph may be missing nodes, properties of nodes, or dependencies.
     * This is useful mostly for visualization/debugging. It should not be used for running tasks.
     */
    getPartialProjectGraph(): ProjectGraph;
    getPartialSourcemaps(): ConfigurationSourceMaps;
    getErrors(): ProjectGraphErrorTypes[];
}
export declare class MultipleProjectsWithSameNameError extends Error {
    conflicts: Map<string, string[]>;
    projects: Record<string, ProjectConfiguration>;
    constructor(conflicts: Map<string, string[]>, projects: Record<string, ProjectConfiguration>);
}
export declare class ProjectWithExistingNameError extends Error {
    projectName: string;
    projectRoot: string;
    constructor(projectName: string, projectRoot: string);
}
export declare function isProjectWithExistingNameError(e: unknown): e is ProjectWithExistingNameError;
export declare function isMultipleProjectsWithSameNameError(e: unknown): e is MultipleProjectsWithSameNameError;
export declare class ProjectsWithNoNameError extends Error {
    projectRoots: string[];
    projects: Record<string, ProjectConfiguration>;
    constructor(projectRoots: string[], projects: Record<string, ProjectConfiguration>);
}
export declare function isProjectsWithNoNameError(e: unknown): e is ProjectsWithNoNameError;
export declare class ProjectWithNoNameError extends Error {
    projectRoot: string;
    constructor(projectRoot: string);
}
export declare function isProjectWithNoNameError(e: unknown): e is ProjectWithNoNameError;
export declare class ProjectConfigurationsError extends Error {
    readonly errors: Array<MergeNodesError | AggregateCreateNodesError | ProjectsWithNoNameError | MultipleProjectsWithSameNameError | WorkspaceValidityError>;
    readonly partialProjectConfigurationsResult: ConfigurationResult;
    constructor(errors: Array<MergeNodesError | AggregateCreateNodesError | ProjectsWithNoNameError | MultipleProjectsWithSameNameError | WorkspaceValidityError>, partialProjectConfigurationsResult: ConfigurationResult);
}
export declare function isProjectConfigurationsError(e: unknown): e is ProjectConfigurationsError;
/**
 * This error should be thrown when a `createNodesV2` function hits a recoverable error.
 * It allows Nx to recieve partial results and continue processing for better UX.
 */
export declare class AggregateCreateNodesError extends Error {
    readonly errors: Array<[file: string | null, error: Error]>;
    readonly partialResults: Awaited<ReturnType<CreateNodesFunctionV2>>;
    pluginIndex: number | undefined;
    /**
     * Throwing this error from a `createNodesV2` function will allow Nx to continue processing and recieve partial results from your plugin.
     * @example
     * export async function createNodesV2(
     *  files: string[],
     * ) {
     *   const partialResults = [];
     *   const errors = [];
     *   await Promise.all(files.map(async (file) => {
     *     try {
     *        const result = await createNodes(file);
     *        partialResults.push(result);
     *     } catch (e) {
     *        errors.push([file, e]);
     *     }
     *   }));
     *  if (errors.length > 0) {
     *     throw new AggregateCreateNodesError(errors, partialResults);
     *   }
     *   return partialResults;
     * }
     *
     * @param errors An array of tuples that represent errors encountered when processing a given file. An example entry might look like ['path/to/project.json', [Error: 'Invalid JSON. Unexpected token 'a' in JSON at position 0]]
     * @param partialResults The partial results of the `createNodesV2` function. This should be the results for each file that didn't encounter an issue.
     */
    constructor(errors: Array<[file: string | null, error: Error]>, partialResults: Awaited<ReturnType<CreateNodesFunctionV2>>);
}
export declare function formatAggregateCreateNodesError(error: AggregateCreateNodesError, pluginName: string): void;
export declare class MergeNodesError extends Error {
    file: string;
    pluginName: string;
    pluginIndex: number;
    constructor({ file, pluginName, error, pluginIndex, }: {
        file: string;
        pluginName: string;
        error: Error;
        pluginIndex?: number;
    });
}
export declare class CreateMetadataError extends Error {
    readonly error: Error;
    readonly plugin: string;
    constructor(error: Error, plugin: string);
}
export declare class ProcessDependenciesError extends Error {
    readonly pluginName: string;
    constructor(pluginName: string, { cause }: {
        cause: any;
    });
}
export declare class WorkspaceValidityError extends Error {
    message: string;
    constructor(message: string);
    toString(): string;
}
export declare function isWorkspaceValidityError(e: unknown): e is WorkspaceValidityError;
export declare class AggregateProjectGraphError extends Error {
    readonly errors: Array<CreateMetadataError | ProcessDependenciesError | WorkspaceValidityError>;
    readonly partialProjectGraph: ProjectGraph;
    constructor(errors: Array<CreateMetadataError | ProcessDependenciesError | WorkspaceValidityError>, partialProjectGraph: ProjectGraph);
}
export declare function isAggregateProjectGraphError(e: unknown): e is AggregateProjectGraphError;
export declare function isCreateMetadataError(e: unknown): e is CreateMetadataError;
export declare function isAggregateCreateNodesError(e: unknown): e is AggregateCreateNodesError;
export declare function isMergeNodesError(e: unknown): e is MergeNodesError;
export declare class DaemonProjectGraphError extends Error {
    errors: any[];
    readonly projectGraph: ProjectGraph;
    readonly sourceMaps: ConfigurationSourceMaps;
    constructor(errors: any[], projectGraph: ProjectGraph, sourceMaps: ConfigurationSourceMaps);
}
export declare class LoadPluginError extends Error {
    plugin: string;
    constructor(plugin: string, cause: Error);
}
