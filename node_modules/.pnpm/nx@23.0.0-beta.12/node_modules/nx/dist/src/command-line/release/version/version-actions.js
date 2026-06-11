"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOOP_VERSION_ACTIONS = exports.VersionActions = void 0;
exports.resolveVersionActionsForProject = resolveVersionActionsForProject;
const node_path_1 = require("node:path");
const register_1 = require("../../../plugins/js/utils/register");
const typescript_1 = require("../../../plugins/js/utils/typescript");
const utils_1 = require("../../../tasks-runner/utils");
const workspace_root_1 = require("../../../utils/workspace-root");
const config_1 = require("../config/config");
const semver_1 = require("../utils/semver");
const release_group_processor_1 = require("./release-group-processor");
function resolveVersionActionsPath(path, projectGraphNode) {
    try {
        return require.resolve(path);
    }
    catch {
        try {
            return require.resolve((0, node_path_1.join)(workspace_root_1.workspaceRoot, path));
        }
        catch {
            if (path === config_1.DEFAULT_VERSION_ACTIONS_PATH) {
                throw new Error(`Unable to resolve the default "versionActions" implementation for project "${projectGraphNode.name}" at path: "${path}"

- If this is a JavaScript/TypeScript project, it is likely that you simply need to install the "@nx/js" plugin.

- If this not a JavaScript/TypeScript project, you can should provide an alternative "versionActions" implementation path via the "release.version.versionActions" configuration option.
`);
            }
            throw new Error(`Unable to resolve the "versionActions" implementation for project "${projectGraphNode.name}" at the configured path: "${path}"`);
        }
    }
}
const versionActionsResolutionCache = new Map();
async function resolveVersionActionsForProject(tree, releaseGroup, projectGraphNode, finalConfigForProject) {
    // Project level release version config takes priority, if set
    const projectVersionConfig = projectGraphNode.data.release?.version;
    const releaseGroupVersionConfig = releaseGroup.version;
    const versionActionsPathConfig = projectVersionConfig?.versionActions ??
        releaseGroupVersionConfig?.versionActions ??
        null;
    if (!versionActionsPathConfig) {
        // Should be an impossible state, as we should have defaulted to the JS implementation during config processing
        throw new Error(`No versionActions implementation found for project "${projectGraphNode.name}", please report this on https://github.com/nrwl/nx/issues`);
    }
    let cachedData = versionActionsResolutionCache.get(versionActionsPathConfig);
    const versionActionsPath = resolveVersionActionsPath(versionActionsPathConfig, projectGraphNode);
    let VersionActionsClass;
    let afterAllProjectsVersioned;
    if (cachedData) {
        VersionActionsClass = cachedData.VersionActionsClass;
        afterAllProjectsVersioned = cachedData.afterAllProjectsVersioned;
    }
    else {
        let cleanupTranspiler;
        if (versionActionsPath.endsWith('.ts')) {
            cleanupTranspiler = (0, register_1.registerTsProject)((0, typescript_1.getRootTsConfigPath)());
        }
        const loaded = require(versionActionsPath);
        cleanupTranspiler?.();
        VersionActionsClass = loaded.default ?? loaded;
        if (!VersionActionsClass) {
            throw new Error(`For project "${projectGraphNode.name}" it was not possible to resolve the VersionActions implementation from: "${versionActionsPath}"`);
        }
        afterAllProjectsVersioned =
            loaded.afterAllProjectsVersioned ??
                // no-op fallback for ecosystems/use-cases where it is not applicable
                (() => Promise.resolve({
                    changedFiles: [],
                    deletedFiles: [],
                }));
        versionActionsResolutionCache.set(versionActionsPath, {
            VersionActionsClass,
            afterAllProjectsVersioned,
        });
    }
    const versionActions = new VersionActionsClass(releaseGroup, projectGraphNode, finalConfigForProject);
    // Initialize the version actions with all the required manifest paths etc
    await versionActions.init(tree);
    return {
        versionActionsPath,
        versionActions,
        afterAllProjectsVersioned,
    };
}
class VersionActions {
    constructor(releaseGroup, projectGraphNode, finalConfigForProject) {
        this.releaseGroup = releaseGroup;
        this.projectGraphNode = projectGraphNode;
        this.finalConfigForProject = finalConfigForProject;
        /**
         * The interpolated manifest paths to update, if applicable based on the user's configuration, when new
         * versions and dependencies are determined. If no manifest files should be updated based on the user's
         * configuration, this will be an empty array.
         *
         * The final value for preserveLocalDependencyProtocols will be based on the resolved config for the current
         * project and any overrides from the user's configuration for the manifestRootsToUpdate.
         */
        this.manifestsToUpdate = [];
    }
    /**
     * Asynchronous initialization of the version actions and resolution of manifest paths.
     * Note: This does NOT validate that manifest files exist - that happens later in validate().
     */
    async init(tree) {
        // Default to the first available source manifest root, if applicable, if no custom manifest roots are provided
        if (this.validManifestFilenames?.length &&
            this.finalConfigForProject.manifestRootsToUpdate.length === 0) {
            for (const manifestFilename of this.validManifestFilenames) {
                if (tree.exists((0, node_path_1.join)(this.projectGraphNode.data.root, manifestFilename))) {
                    this.finalConfigForProject.manifestRootsToUpdate.push({
                        path: this.projectGraphNode.data.root,
                        preserveLocalDependencyProtocols: this.finalConfigForProject.preserveLocalDependencyProtocols,
                    });
                    break;
                }
            }
        }
        const interpolatedManifestRoots = this.finalConfigForProject.manifestRootsToUpdate.map((manifestRoot) => {
            return {
                ...manifestRoot,
                path: (0, utils_1.interpolate)(manifestRoot.path, {
                    workspaceRoot: '',
                    projectRoot: this.projectGraphNode.data.root,
                    projectName: this.projectGraphNode.name,
                }),
            };
        });
        // Build manifestsToUpdate but don't validate existence yet as that could break release graph construction before preVersionCommands have run
        for (const interpolatedManifestRoot of interpolatedManifestRoots) {
            for (const manifestFilename of this.validManifestFilenames) {
                const manifestPath = (0, node_path_1.join)(interpolatedManifestRoot.path, manifestFilename);
                // Just add the first matching filename pattern, actual existence check happens in validate()
                this.manifestsToUpdate.push({
                    ...interpolatedManifestRoot,
                    manifestPath,
                });
                break;
            }
        }
    }
    /**
     * Validates that manifest files actually exist.
     * This will be called after all preVersionCommands have run.
     */
    async validate(tree) {
        // Skip if no manifest files are expected
        if (!this.validManifestFilenames?.length) {
            return;
        }
        // Simply check each manifest exists
        for (const manifest of this.manifestsToUpdate) {
            if (!tree.exists(manifest.manifestPath)) {
                const validManifestFilenames = this.validManifestFilenames?.join(' or ');
                // Get directory path for error message using Node's path module for cross-platform compatibility
                let rootPath = manifest.manifestPath;
                for (const filename of this.validManifestFilenames) {
                    rootPath = rootPath.replace(filename, '');
                }
                throw new Error(`The project "${this.projectGraphNode.name}" does not have a ${validManifestFilenames} file available in ${rootPath}

To fix this you will either need to add a ${validManifestFilenames} file at that location, or configure "release" within your nx.json to exclude "${this.projectGraphNode.name}" from the current release group, or amend the "release.version.manifestRootsToUpdate" configuration to point to where the relevant manifest should be.

It is also possible that the project is being processed because of a dependency relationship between what you are directly versioning and the project/release group, in which case you will need to amend your filters to include all relevant projects and release groups.`);
            }
        }
    }
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
    async calculateNewVersion(currentVersion, newVersionInput, newVersionInputReason, newVersionInputReasonData, preid) {
        const isSemverRelativeBump = (0, semver_1.isRelativeVersionKeyword)(newVersionInput);
        const newVersionReasonText = release_group_processor_1.BUMP_TYPE_REASON_TEXT[newVersionInputReason];
        if (!newVersionReasonText) {
            throw new Error(`Unhandled bump type reason for ${this.projectGraphNode.name} with newVersionInput ${newVersionInput} and newVersionInputReason ${newVersionInputReason}, please report this as a bug on https://github.com/nrwl/nx/issues`);
        }
        const interpolatedNewVersionInputReasonText = (0, utils_1.interpolate)(newVersionReasonText, newVersionInputReasonData);
        if (isSemverRelativeBump && !currentVersion) {
            throw new Error(`There was no current version resolved for project "${this.projectGraphNode.name}", but it was configured to be bumped via a semver relative keyword "${newVersionInput}"${interpolatedNewVersionInputReasonText}. This is not a valid combination, please review your release configuration and CLI arguments`);
        }
        const newVersion = (0, semver_1.deriveNewSemverVersion)(currentVersion, newVersionInput, preid, {
            adjustSemverBumpsForZeroMajorVersion: this.finalConfigForProject.adjustSemverBumpsForZeroMajorVersion,
        });
        const newVersionInputText = (0, semver_1.isRelativeVersionKeyword)(newVersionInput)
            ? `semver relative bump "${newVersionInput}"`
            : `explicit semver value "${newVersionInput}"`;
        return {
            newVersion,
            logText: `❓ Applied ${newVersionInputText}${interpolatedNewVersionInputReasonText}to get new version ${newVersion}`,
        };
    }
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
    async readDependencies(tree, projectGraph) {
        return (projectGraph.dependencies[this.projectGraphNode.name] ?? []).filter(
        // Skip implicit dependencies for now to match legacy versioning behavior
        // TODO: holistically figure out how to handle implicit dependencies with nx release
        (dep) => dep.type !== 'implicit');
    }
}
exports.VersionActions = VersionActions;
class NOOP_VERSION_ACTIONS extends VersionActions {
    constructor() {
        super(...arguments);
        this.validManifestFilenames = null;
    }
    async validate(tree) {
        // Nothing to validate, patch base method
        return;
    }
    readCurrentVersionFromRegistry(tree, currentVersionResolverMetadata) {
        return Promise.resolve(null);
    }
    readCurrentVersionFromSourceManifest(tree) {
        return Promise.resolve(null);
    }
    readCurrentVersionOfDependency(tree, projectGraph, dependencyProjectName) {
        return Promise.resolve({
            currentVersion: null,
            dependencyCollection: null,
        });
    }
    async calculateNewVersion(currentVersion, newVersionInput, newVersionInputReason, newVersionInputReasonData, preid) {
        return Promise.resolve({
            newVersion: '0.0.0',
            logText: 'Skipped default versioning as no-op.',
        });
    }
    updateProjectDependencies(tree, projectGraph, dependenciesToUpdate) {
        return Promise.resolve([]);
    }
    updateProjectVersion(tree, newVersion) {
        return Promise.resolve([]);
    }
}
exports.NOOP_VERSION_ACTIONS = NOOP_VERSION_ACTIONS;
