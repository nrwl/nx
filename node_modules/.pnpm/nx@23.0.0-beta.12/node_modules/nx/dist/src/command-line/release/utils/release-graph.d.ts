import type { NxReleaseDockerConfiguration, NxReleaseVersionConfiguration } from '../../../config/nx-json';
import type { ProjectGraph } from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import { type NxReleaseConfig } from '../config/config';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import { ProjectLogger } from '../version/project-logger';
import { type AfterAllProjectsVersioned, type VersionActions } from '../version/version-actions';
import { GetLatestGitTagForPatternOptions, GitCommit } from './git';
/**
 * Final configuration for a project after applying release group and project level overrides
 */
export interface FinalConfigForProject {
    specifierSource: NxReleaseVersionConfiguration['specifierSource'];
    currentVersionResolver: NxReleaseVersionConfiguration['currentVersionResolver'];
    currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata'];
    fallbackCurrentVersionResolver: NxReleaseVersionConfiguration['fallbackCurrentVersionResolver'];
    versionPrefix: NxReleaseVersionConfiguration['versionPrefix'];
    preserveLocalDependencyProtocols: NxReleaseVersionConfiguration['preserveLocalDependencyProtocols'];
    preserveMatchingDependencyRanges: NxReleaseVersionConfiguration['preserveMatchingDependencyRanges'];
    adjustSemverBumpsForZeroMajorVersion: NxReleaseVersionConfiguration['adjustSemverBumpsForZeroMajorVersion'];
    applyPreidToDependents: NxReleaseVersionConfiguration['applyPreidToDependents'];
    versionActionsOptions: NxReleaseVersionConfiguration['versionActionsOptions'];
    manifestRootsToUpdate: Array<Exclude<NxReleaseVersionConfiguration['manifestRootsToUpdate'][number], string>>;
    dockerOptions: NxReleaseDockerConfiguration & {
        groupPreVersionCommand?: string;
    };
}
interface GroupNode {
    group: ReleaseGroupWithName;
    dependencies: Set<string>;
    dependents: Set<string>;
}
export interface CreateReleaseGraphOptions {
    tree: Tree;
    projectGraph: ProjectGraph;
    nxReleaseConfig: NxReleaseConfig;
    filters: {
        projects?: string[];
        groups?: string[];
    };
    firstRelease: boolean;
    preid?: string;
    verbose: boolean;
    /**
     * Current version resolution is not needed for publishing, so in cases where the publish subcommand needs to build a release graph,
     * we allow it to skip this step.
     */
    skipVersionResolution?: boolean;
    versionActionsOptionsOverrides?: Record<string, unknown>;
}
export declare const validReleaseVersionPrefixes: readonly ["auto", "", "~", "^", "="];
/**
 * The complete release graph containing all relationships, caches, and computed data
 * necessary for efficient release operations across versioning, changelog, and publishing.
 *
 * This class encapsulates the complex dependency graph between projects and release groups,
 * providing convenient methods for querying relationships and accessing cached data.
 */
export declare class ReleaseGraph {
    releaseGroups: ReleaseGroupWithName[];
    readonly filters: {
        projects?: string[];
        groups?: string[];
    };
    readonly projectToReleaseGroup: Map<string, ReleaseGroupWithName>;
    readonly projectToDependents: Map<string, Set<string>>;
    readonly projectToDependencies: Map<string, Set<string>>;
    readonly projectToUpdateDependentsSetting: Map<string, "auto" | "always" | "never">;
    readonly groupGraph: Map<string, GroupNode>;
    sortedReleaseGroups: string[];
    readonly sortedProjects: Map<string, string[]>;
    readonly allProjectsConfiguredForNxRelease: Set<string>;
    allProjectsToProcess: Set<string>;
    readonly finalConfigsByProject: Map<string, FinalConfigForProject>;
    readonly projectsToVersionActions: Map<string, VersionActions>;
    readonly uniqueAfterAllProjectsVersioned: Map<string, AfterAllProjectsVersioned>;
    readonly projectLoggers: Map<string, ProjectLogger>;
    readonly cachedCurrentVersions: Map<string, string>;
    readonly cachedLatestMatchingGitTag: Map<string, import("./git").GitTagAndVersion>;
    readonly currentVersionsPerFixedReleaseGroup: Map<string, {
        currentVersion: string;
        originatingProjectName: string;
        logText: string;
    }>;
    readonly originalDependentProjectsPerProject: Map<string, {
        source: string;
        target: string;
        type: string;
        dependencyCollection: string;
        rawVersionSpec: string;
    }[]>;
    readonly releaseGroupToFilteredProjects: Map<ReleaseGroupWithName, Set<string>>;
    private originalFilteredProjects;
    /**
     * Store the affected graph per commit per project
     * to avoid recomputation of the graph on workspace
     * with multiple projects
     */
    private affectedGraphPerCommit;
    private repositoryGitTags;
    /**
     * User-friendly log describing what the filter matched.
     * Null if no filters were applied.
     */
    filterLog: {
        title: string;
        bodyLines: string[];
    } | null;
    constructor(releaseGroups: ReleaseGroupWithName[], filters: {
        projects?: string[];
        groups?: string[];
    });
    /**
     * Initialize the graph by building all relationships and caches
     * @internal - Called by createReleaseGraph(), not meant for external use
     */
    init(options: CreateReleaseGraphOptions): Promise<void>;
    /**
     * Setup mapping from project to release group and cache updateDependents settings
     */
    private setupProjectReleaseGroupMapping;
    /**
     * Apply initial filtering to construct releaseGroupToFilteredProjects based on filters.
     * This determines the base set of projects and groups before considering dependencies.
     */
    private applyInitialFiltering;
    /**
     * Check if any filters are applied
     */
    private hasAnyFilters;
    /**
     * Setup projects to process and resolve version actions
     */
    private setupProjectsToProcess;
    /**
     * Precompute dependency relationships between all projects
     */
    private precomputeDependencyRelationships;
    /**
     * Apply dependency-aware filtering that considers updateDependents configuration.
     * This includes transitive dependents based on updateDependents setting ('always' by default, or 'auto').
     */
    private applyDependencyAwareFiltering;
    /**
     * Validate that the filter doesn't try to isolate projects in fixed release groups
     */
    private validateFilterAgainstFixedGroups;
    /**
     * Find dependents that should be included in processing based on updateDependents configuration
     */
    private findDependentsToProcess;
    /**
     * Generate user-friendly log describing what the filter matched
     */
    private generateFilterLog;
    /**
     * Build the group graph structure
     */
    private buildGroupGraphStructure;
    /**
     * Resolve current versions for all projects that will be processed
     */
    private resolveCurrentVersionsForProjects;
    /**
     * Build dependency relationships between release groups
     */
    private buildGroupDependencyGraph;
    /**
     * Topologically sort release groups
     */
    private topologicallySortReleaseGroups;
    /**
     * Topologically sort projects within a release group
     */
    private topologicallySortProjects;
    private populateDependentProjectsData;
    /**
     * Get all non-implicit dependents for a set of projects
     */
    private getAllNonImplicitDependents;
    /**
     * Resolve final configuration for a project
     *
     * NOTE: We are providing ultimate fallback values via ?? here mainly just to keep TypeScript happy.
     * All default values should have been applied by this point by config.ts but the types can't know
     * that for sure at this point.
     */
    private static resolveFinalConfigForProject;
    /**
     * Get the release group for a given project
     */
    getReleaseGroupForProject(projectName: string): ReleaseGroupWithName | undefined;
    /**
     * Get the release group name for a given project
     */
    getReleaseGroupNameForProject(projectName: string): string | null;
    /**
     * Get the dependencies of a project
     */
    getProjectDependencies(projectName: string): Set<string>;
    /**
     * Get the dependents of a project (projects that depend on it)
     */
    getProjectDependents(projectName: string): Set<string>;
    /**
     * Get the version actions for a project
     */
    getVersionActionsForProject(projectName: string): VersionActions | undefined;
    /**
     * Check if a project will be processed
     */
    isProjectToProcess(projectName: string): boolean;
    resolveAffectedFilesPerCommitInProjectGraph(commit: GitCommit, projectGraph: ProjectGraph): Promise<ProjectGraph>;
    resolveRepositoryTags(resolveTagsWhen: GetLatestGitTagForPatternOptions['checkAllBranchesWhen']): Promise<string[]>;
    /**
     * Runs validation on resolved VersionActions instances. E.g. check that manifest files exist for all projects that will be processed.
     * This should be called after preVersionCommand has run, as those commands may create manifest files that are needed for versioning.
     */
    validate(tree: Tree): Promise<void>;
}
/**
 * Creates a complete release graph by analyzing all release groups, projects, and their relationships.
 *
 * This function builds the graph structure, applies filtering logic that considers dependencies
 * and updateDependents configuration, and caches all necessary data.
 *
 * The returned graph can be reused across versioning, changelog, and publishing operations.
 */
export declare function createReleaseGraph(options: CreateReleaseGraphOptions): Promise<ReleaseGraph>;
export {};
