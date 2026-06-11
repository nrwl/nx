import { ReleaseType } from 'semver';
import { NxReleaseVersionConfiguration } from '../../../config/nx-json';
import type { ProjectGraph, ProjectGraphDependency, ProjectGraphProjectNode } from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import type { ReleaseGroupWithName } from '../config/filter-release-groups';
import type { FinalConfigForProject } from '../utils/release-graph';
export type SemverBumpType = ReleaseType | 'none';
/**
 * Implementation details of performing any actions after all projects have been versioned.
 * An example might be updating a workspace level lock file.
 *
 * NOTE: By the time this function is invoked, the tree will have been flushed back to disk,
 * so it is not accessible here.
 *
 * The function should return lists of changed and deleted files so that they can be staged
 * and committed if appropriate.
 *
 * NOTE: The versionActionsOptions passed here are the ones at the root of release.version config,
 * different values per release group or project will not be respected here because this takes
 * place after all projects have been versioned.
 */
export type AfterAllProjectsVersioned = (cwd: string, opts: {
    dryRun?: boolean;
    verbose?: boolean;
    rootVersionActionsOptions?: Record<string, unknown>;
}) => Promise<{
    changedFiles: string[];
    deletedFiles: string[];
}>;
export declare function resolveVersionActionsForProject(tree: Tree, releaseGroup: ReleaseGroupWithName, projectGraphNode: ProjectGraphProjectNode, finalConfigForProject: FinalConfigForProject): Promise<{
    versionActionsPath: string;
    versionActions: VersionActions;
    afterAllProjectsVersioned: AfterAllProjectsVersioned;
}>;
export declare abstract class VersionActions {
    releaseGroup: ReleaseGroupWithName;
    projectGraphNode: ProjectGraphProjectNode;
    finalConfigForProject: FinalConfigForProject;
    /**
     * The available valid filenames of the manifest file relevant to the current versioning use-case.
     *
     * E.g. for JavaScript projects this would be ["package.json"], but for Gradle it would be
     * ["build.gradle", "build.gradle.kts"].
     *
     * If a manifest file is not applicable to the current versioning use-case, this should be set to null.
     */
    abstract validManifestFilenames: string[] | null;
    /**
     * The interpolated manifest paths to update, if applicable based on the user's configuration, when new
     * versions and dependencies are determined. If no manifest files should be updated based on the user's
     * configuration, this will be an empty array.
     *
     * The final value for preserveLocalDependencyProtocols will be based on the resolved config for the current
     * project and any overrides from the user's configuration for the manifestRootsToUpdate.
     */
    manifestsToUpdate: {
        manifestPath: string;
        preserveLocalDependencyProtocols: boolean;
    }[];
    constructor(releaseGroup: ReleaseGroupWithName, projectGraphNode: ProjectGraphProjectNode, finalConfigForProject: FinalConfigForProject);
    /**
     * Asynchronous initialization of the version actions and resolution of manifest paths.
     * Note: This does NOT validate that manifest files exist - that happens later in validate().
     */
    init(tree: Tree): Promise<void>;
    /**
     * Validates that manifest files actually exist.
     * This will be called after all preVersionCommands have run.
     */
    validate(tree: Tree): Promise<void>;
    /**
     * The default implementation will calculate the new version based on semver. If semver is not applicable to a
     * particular versioning use-case, this method should be overridden with custom logic.
     *
     * @param {string | null} currentVersion - The current version of the project, or null if the current version resolver is set to 'none'
     * @param {string} newVersionInput - The new version input provided by the user, such as a semver relative bump type, or an explicit version
     * @param {string} newVersionInputReason - The reason for the new version input used to inform the log message to show to the user
     * @param {Record<string, unknown>} newVersionInputReasonData - The data to interpolate into the new version input reason
     * @param {string} preid - The preid to use for the new version, if applicable
     */
    calculateNewVersion(currentVersion: string | null, newVersionInput: string, newVersionInputReason: string, newVersionInputReasonData: Record<string, unknown>, preid: string): Promise<{
        newVersion: string;
        logText: string;
    }>;
    /**
     * Implementation details of resolving a project's current version from a valid manifest file. It should
     * return an object with the current version and the filename of the resolved manifest path so that the
     * logs provided to the user are as specific as possible.
     *
     * This method will only be called if the user has configured their currentVersionResolver to be "disk".
     *
     * If the version actions implementation does not support a manifest file, this method can either throw
     * an error or return null. In this case, nx release will handle showing the user a relevant error about
     * their currentVersionResolver configuration being fundamentally incompatible with the current version
     * actions implementation resolved for the project being versioned and they can change it to something else
     * (e.g. "registry" or "git-tag").
     *
     * NOTE: The version actions implementation does not need to provide the method for handling resolution
     * from git tags, this is done directly by nx release.
     */
    abstract readCurrentVersionFromSourceManifest(tree: Tree): Promise<{
        currentVersion: string;
        manifestPath: string;
    } | null>;
    /**
     * Implementation details of resolving a project's current version from a remote registry.
     *
     * The specific logText it returns will be combined with the generic remote registry log text and allows
     * the implementation to provide more specific information to the user about what registry URL
     * was used, what dist-tag etc.
     *
     * If the version actions implementation does not support resolving from a remote registry, this method
     * can either throw an error or return null. In this case, nx release will handle showing the user a relevant
     * error about their currentVersionResolver configuration being fundamentally incompatible with the current
     * version actions implementation resolved for the project being versioned and they can change it to something
     * else (e.g. "disk" or "git-tag").
     *
     * NOTE: The version actions implementation does not need to provide the method for handling resolution
     * from git tags, this is done directly by nx release.
     */
    abstract readCurrentVersionFromRegistry(tree: Tree, currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata']): Promise<{
        currentVersion: string | null;
        logText: string;
    } | null>;
    /**
     * Implementation details of resolving the dependencies of a project.
     *
     * The default implementation will read dependencies from the Nx project graph. In many cases this will be sufficient,
     * because the project graph will have been constructed using plugins from relevant ecosystems that should have applied
     * any and all relevant metadata to the project nodes and dependency edges.
     *
     * If, however, the project graph cannot be used as the source of truth for whatever reason, then this default method
     * can simply be overridden in the final version actions implementation.
     */
    readDependencies(tree: Tree, projectGraph: ProjectGraph): Promise<ProjectGraphDependency[]>;
    /**
     * Implementation details of resolving the current version of a specific dependency of the project.
     *
     * The dependency collection is the type of dependency collection to which the dependency belongs, such as 'dependencies',
     * 'devDependencies', 'peerDependencies', 'optionalDependencies', etc. This is ecosystem and use-case specific.
     *
     * The currentVersion and dependencyCollection fields will be used to populate the rawVersionSpec and dependencyCollection
     * fields on the VersionData that gets returned from the programmatic API. `null` values are accepted for these if the current
     * version or dependencyCollection is not applicable/resolvable at all, but they should be provided if possible.
     *
     * The currentVersion will also be used when calculating the final versionPrefix to apply for the new dependency
     * version, based on the user's configuration, if applicable.
     */
    abstract readCurrentVersionOfDependency(tree: Tree, projectGraph: ProjectGraph, dependencyProjectName: string): Promise<{
        currentVersion: string | null;
        dependencyCollection: string | null;
    }>;
    /**
     * Implementation details of updating a newly derived version in some source of truth.
     *
     * For libraries/packages, this will usually involve writing to one or more manifest files
     * (e.g. potentially both src and dist), such as a package.json/Cargo.toml/etc, but for
     * application deployments it might involve updating something else instead, it depends on
     * the type of application.
     *
     * It should return an array of log messages that will be displayed unmodified to the user
     * after the version has been updated.
     */
    abstract updateProjectVersion(tree: Tree, newVersion: string): Promise<string[]>;
    /**
     * Implementation details of updating dependencies in some source of truth.
     *
     * For libraries/packages, this will usually involve writing to one or more manifest files
     * (e.g. potentially both src and dist), such as a package.json/Cargo.toml/etc,
     * with new dependency versions, but for application deployments it might involve
     * updating something else instead, it depends on the type of application.
     *
     * It should return an array of log messages that will be displayed unmodified to the user
     * after the dependencies have been updated.
     */
    abstract updateProjectDependencies(tree: Tree, projectGraph: ProjectGraph, dependenciesToUpdate: Record<string, string>): Promise<string[]>;
}
export declare class NOOP_VERSION_ACTIONS extends VersionActions {
    validManifestFilenames: any;
    validate(tree: Tree): Promise<void>;
    readCurrentVersionFromRegistry(tree: Tree, currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata']): Promise<{
        currentVersion: string | null;
        logText: string;
    } | null>;
    readCurrentVersionFromSourceManifest(tree: Tree): Promise<{
        currentVersion: string;
        manifestPath: string;
    } | null>;
    readCurrentVersionOfDependency(tree: Tree, projectGraph: ProjectGraph, dependencyProjectName: string): Promise<{
        currentVersion: string | null;
        dependencyCollection: string | null;
    }>;
    calculateNewVersion(currentVersion: string | null, newVersionInput: string, newVersionInputReason: string, newVersionInputReasonData: Record<string, unknown>, preid: string): Promise<{
        newVersion: string;
        logText: string;
    }>;
    updateProjectDependencies(tree: Tree, projectGraph: ProjectGraph, dependenciesToUpdate: Record<string, string>): Promise<string[]>;
    updateProjectVersion(tree: Tree, newVersion: string): Promise<string[]>;
}
