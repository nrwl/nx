import { ProjectGraph } from '../../../config/project-graph';
import { Tree } from '../../../generators/tree';
import { type NxReleaseConfig } from '../config/config';
import { ReleaseGraph } from '../utils/release-graph';
import type { VersionData } from '../utils/shared';
export declare const BUMP_TYPE_REASON_TEXT: {
    readonly DEPENDENCY_WAS_BUMPED: ", because a dependency was bumped, ";
    readonly USER_SPECIFIER: ", from the given specifier, ";
    readonly PROMPTED_USER_SPECIFIER: ", from the prompted specifier, ";
    readonly CONVENTIONAL_COMMITS: ", derived from conventional commits data, ";
    readonly VERSION_PLANS: ", read from version plan {versionPlanPath}, ";
    readonly DEPENDENCY_ACROSS_GROUPS_WAS_BUMPED: ", because a dependency project belonging to another release group was bumped, ";
    readonly OTHER_PROJECT_IN_FIXED_GROUP_WAS_BUMPED_DUE_TO_DEPENDENCY: ", because of a dependency-only bump to another project in the same fixed release group, ";
    readonly NOOP_VERSION_ACTIONS: ", because this project uses docker and has been configured to skip VersionActions, ";
};
interface ReleaseGroupProcessorOptions {
    dryRun: boolean;
    verbose: boolean;
    firstRelease: boolean;
    preid: string;
    userGivenSpecifier?: string;
    projectsToProcess?: string[];
    /**
     * The optional results of applying the --project or --group filters.
     * These will be empty if there is no filtering, or contain the subset of projects or groups that
     * are being versioned if one of the (mutually exclusive) filters is set.
     */
    filters: {
        projects?: string[];
        groups?: string[];
    };
    versionActionsOptionsOverrides?: Record<string, unknown>;
}
export declare class ReleaseGroupProcessor {
    private tree;
    private projectGraph;
    private nxReleaseConfig;
    private releaseGraph;
    private options;
    /**
     * Tracks which release groups have already been processed to avoid
     * processing them multiple times. Used during the group traversal.
     */
    private processedGroups;
    /**
     * Keeps track of which projects have already had their versions bumped.
     * This is used to avoid redundant version bumping and to determine which
     * projects need their dependencies updated.
     */
    private bumpedProjects;
    /**
     * versionData that will ultimately be returned to the nx release version handler by getVersionData()
     */
    private versionData;
    /**
     * If the user provided a specifier at the time of versioning we store it here so that it can take priority
     * over any configuration.
     */
    private userGivenSpecifier;
    /**
     * Track any version plan files that have been processed so that we can delete them after versioning is complete,
     * while leaving any unprocessed files in place.
     */
    private processedVersionPlanFiles;
    constructor(tree: Tree, projectGraph: ProjectGraph, nxReleaseConfig: NxReleaseConfig, releaseGraph: ReleaseGraph, options: ReleaseGroupProcessorOptions);
    getReleaseGroupNameForProject(projectName: string): string | null;
    getNextGroup(): string | null;
    processGroups(): Promise<string[]>;
    flushAllProjectLoggers(): void;
    deleteProcessedVersionPlanFiles(): void;
    getVersionData(): VersionData;
    /**
     * Invoke the afterAllProjectsVersioned functions for each unique versionActions type.
     * This can be useful for performing actions like updating a workspace level lock file.
     *
     * Because the tree has already been flushed to disk at this point, each afterAllProjectsVersioned
     * function is responsible for returning the list of changed and deleted files that it affected.
     *
     * The root level `release.version.versionActionsOptions` is what is passed in here because this
     * is a one time action for the whole workspace. Release group and project level overrides are
     * not applicable.
     */
    afterAllProjectsVersioned(rootVersionActionsOptions: Record<string, unknown>): Promise<{
        changedFiles: string[];
        deletedFiles: string[];
    }>;
    processDockerProjects(dockerVersionScheme?: string, dockerVersion?: string): Promise<void>;
    private processGroup;
    private bumpVersions;
    private bumpFixedVersionGroup;
    private bumpIndependentVersionGroup;
    private determineVersionBumpForProject;
    private getVersionActionsForProject;
    private getProjectLoggerForProject;
    private getCurrentCachedVersionForProject;
    private getCachedFinalConfigForProject;
    private calculateNewVersion;
    private updateDependenciesForProject;
    private bumpVersionForProject;
    private updateDependenciesForDependents;
    private getOriginalDependentProjects;
    private getFixedReleaseGroupBumpType;
    private determineSideEffectBump;
    /**
     * When a preid is set (e.g. --preid rc) and the project has opted in via
     * `applyPreidToDependents`, convert a "patch" side-effect bump into a
     * "prepatch" so that semver.inc() actually applies the preid.
     * semver.inc('1.0.0', 'patch', 'rc') ignores preid and returns '1.0.1'.
     * semver.inc('1.0.0', 'prepatch', 'rc') returns '1.0.1-rc.0' as expected.
     */
    private applyPreidToBumpType;
    private getProjectDependents;
    private getNonImplicitDependentsForProject;
}
export {};
