/**
 * Builder for adding nodes and dependencies to a {@link ProjectGraph}
 */
import { DependencyType, FileMap, ProjectFileMap, ProjectGraph, ProjectGraphExternalNode, ProjectGraphProjectNode } from '../config/project-graph';
import { CreateDependenciesContext } from './plugins';
/**
 * A class which builds up a project graph
 * @deprecated The {@link ProjectGraphProcessor} has been deprecated. Use a {@link CreateNodes} and/or a {@link CreateDependencies} instead. This will be removed in Nx 20.
 */
export declare class ProjectGraphBuilder {
    readonly graph: ProjectGraph;
    private readonly projectFileMap;
    private readonly nonProjectFiles;
    readonly removedEdges: {
        [source: string]: Set<string>;
    };
    constructor(graph?: ProjectGraph, projectFileMap?: ProjectFileMap, nonProjectFiles?: FileMap['nonProjectFiles']);
    /**
     * Merges the nodes and dependencies of p into the built project graph.
     */
    mergeProjectGraph(p: ProjectGraph): void;
    /**
     * Adds a project node to the project graph
     */
    addNode(node: ProjectGraphProjectNode): void;
    /**
     * Removes a node and all of its dependency edges from the graph
     */
    removeNode(name: string): void;
    /**
     * Adds a external node to the project graph
     */
    addExternalNode(node: ProjectGraphExternalNode): void;
    /**
     * Adds static dependency from source project to target project
     */
    addStaticDependency(sourceProjectName: string, targetProjectName: string, sourceProjectFile?: string): void;
    /**
     * Adds dynamic dependency from source project to target project
     */
    addDynamicDependency(sourceProjectName: string, targetProjectName: string, sourceProjectFile: string): void;
    /**
     * Adds implicit dependency from source project to target project
     */
    addImplicitDependency(sourceProjectName: string, targetProjectName: string): void;
    /**
     * Removes a dependency from source project to target project
     */
    removeDependency(sourceProjectName: string, targetProjectName: string): void;
    /**
     * Add an explicit dependency from a file in source project to target project
     * @deprecated this method will be removed in v17. Use {@link addStaticDependency} or {@link addDynamicDependency} instead
     */
    addExplicitDependency(sourceProjectName: string, sourceProjectFile: string, targetProjectName: string): void;
    /**
     * Set version of the project graph
     */
    setVersion(version: string): void;
    getUpdatedProjectGraph(): ProjectGraph;
    addDependency(source: string, target: string, type: DependencyType, sourceFile?: string): void;
    private removeDependenciesWithNode;
    private calculateTargetDepsFromFiles;
    private calculateAlreadySetTargetDeps;
}
/**
 * A static {@link ProjectGraph} dependency between 2 projects
 *
 * This type of dependency indicates the source project ALWAYS load the target project.
 *
 * NOTE: {@link StaticDependency#sourceFile} MUST be present unless the source is the name of a {@link ProjectGraphExternalNode}
 */
export type StaticDependency = {
    /**
     * The name of a {@link ProjectGraphProjectNode} or {@link ProjectGraphExternalNode} depending on the target project
     */
    source: string;
    /**
     * The name of a {@link ProjectGraphProjectNode} or {@link ProjectGraphExternalNode} that the source project depends on
     */
    target: string;
    /**
     * The path of a file (relative from the workspace root) where the dependency is made
     */
    sourceFile?: string;
    type: typeof DependencyType.static;
};
/**
 * A dynamic {@link ProjectGraph} dependency between 2 projects
 *
 * This type of dependency indicates the source project MAY OR MAY NOT load the target project.
 */
export type DynamicDependency = {
    /**
     * The name of a {@link ProjectGraphProjectNode} depending on the target project
     */
    source: string;
    /**
     * The name of a {@link ProjectGraphProjectNode}  that the source project depends on
     */
    target: string;
    /**
     * The path of a file (relative from the workspace root) where the dependency is made
     */
    sourceFile: string;
    type: typeof DependencyType.dynamic;
};
/**
 * An implicit {@link ProjectGraph} dependency between 2 projects
 *
 * This type of dependency indicates a connection without an explicit reference in code
 */
export type ImplicitDependency = {
    /**
     * The name of a {@link ProjectGraphProjectNode} depending on the target project
     */
    source: string;
    /**
     * The name of a {@link ProjectGraphProjectNode} that the source project depends on
     */
    target: string;
    type: typeof DependencyType.implicit;
};
/**
 * A {@link ProjectGraph} dependency between 2 projects
 *
 * See {@link DynamicDependency}, {@link ImplicitDependency}, or {@link StaticDependency}
 */
export type RawProjectGraphDependency = ImplicitDependency | StaticDependency | DynamicDependency;
/**
 * A function to validate dependencies in a {@link CreateDependencies} function
 * @throws If the dependency is invalid.
 */
export declare function validateDependency(dependency: RawProjectGraphDependency, ctx: CreateDependenciesContext): void;
