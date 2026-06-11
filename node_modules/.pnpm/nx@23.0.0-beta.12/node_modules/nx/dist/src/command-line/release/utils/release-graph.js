"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReleaseGraph = exports.validReleaseVersionPrefixes = void 0;
exports.createReleaseGraph = createReleaseGraph;
const affected_project_graph_1 = require("../../../project-graph/affected/affected-project-graph");
const file_utils_1 = require("../../../project-graph/file-utils");
const config_1 = require("../config/config");
const project_logger_1 = require("../version/project-logger");
const resolve_current_version_1 = require("../version/resolve-current-version");
const topological_sort_1 = require("../version/topological-sort");
const version_actions_1 = require("../version/version-actions");
const git_1 = require("./git");
const repository_git_tags_1 = require("./repository-git-tags");
const shared_1 = require("./shared");
exports.validReleaseVersionPrefixes = ['auto', '', '~', '^', '='];
/**
 * The complete release graph containing all relationships, caches, and computed data
 * necessary for efficient release operations across versioning, changelog, and publishing.
 *
 * This class encapsulates the complex dependency graph between projects and release groups,
 * providing convenient methods for querying relationships and accessing cached data.
 */
class ReleaseGraph {
    constructor(releaseGroups, filters) {
        this.releaseGroups = releaseGroups;
        this.filters = filters;
        this.projectToReleaseGroup = new Map();
        this.projectToDependents = new Map();
        this.projectToDependencies = new Map();
        this.projectToUpdateDependentsSetting = new Map();
        this.groupGraph = new Map();
        this.sortedReleaseGroups = [];
        this.sortedProjects = new Map();
        this.allProjectsConfiguredForNxRelease = new Set();
        this.allProjectsToProcess = new Set();
        this.finalConfigsByProject = new Map();
        this.projectsToVersionActions = new Map();
        this.uniqueAfterAllProjectsVersioned = new Map();
        this.projectLoggers = new Map();
        this.cachedCurrentVersions = new Map();
        this.cachedLatestMatchingGitTag = new Map();
        this.currentVersionsPerFixedReleaseGroup = new Map();
        this.originalDependentProjectsPerProject = new Map();
        this.releaseGroupToFilteredProjects = new Map();
        this.originalFilteredProjects = new Set();
        /**
         * Store the affected graph per commit per project
         * to avoid recomputation of the graph on workspace
         * with multiple projects
         */
        this.affectedGraphPerCommit = new Map();
        this.repositoryGitTags = repository_git_tags_1.RepoGitTags.create();
        /**
         * User-friendly log describing what the filter matched.
         * Null if no filters were applied.
         */
        this.filterLog = null;
    }
    /**
     * Initialize the graph by building all relationships and caches
     * @internal - Called by createReleaseGraph(), not meant for external use
     */
    async init(options) {
        // Step 1: Setup project to release group mapping
        this.setupProjectReleaseGroupMapping();
        // Step 2: Apply initial filtering to determine base set of projects and groups to process
        this.applyInitialFiltering();
        // Step 3: Setup projects to process and resolve version actions
        await this.setupProjectsToProcess(options);
        // Step 4: Precompute dependency relationships
        await this.precomputeDependencyRelationships(options.tree, options.projectGraph);
        // Step 5: Apply dependency-aware filtering based on updateDependents
        this.applyDependencyAwareFiltering();
        // Step 5: Build the group graph structure
        this.buildGroupGraphStructure();
        // Step 6: Resolve current versions for all projects to process (unless explicitly skipped)
        if (!options.skipVersionResolution) {
            await this.resolveCurrentVersionsForProjects(options.tree, options.projectGraph, options.preid ?? '');
        }
        // Step 7: Build dependency relationships between groups
        this.buildGroupDependencyGraph();
        // Step 8: Topologically sort groups and projects
        this.sortedReleaseGroups = this.topologicallySortReleaseGroups();
        for (const group of this.releaseGroups) {
            this.sortedProjects.set(group.name, this.topologicallySortProjects(group));
        }
        // Step 9: Populate dependent projects data
        await this.populateDependentProjectsData(options.tree, options.projectGraph);
    }
    /**
     * Setup mapping from project to release group and cache updateDependents settings
     */
    setupProjectReleaseGroupMapping() {
        for (const group of this.releaseGroups) {
            for (const project of group.projects) {
                this.projectToReleaseGroup.set(project, group);
                const updateDependents = group.version?.updateDependents ||
                    'always';
                this.projectToUpdateDependentsSetting.set(project, updateDependents);
            }
        }
    }
    /**
     * Apply initial filtering to construct releaseGroupToFilteredProjects based on filters.
     * This determines the base set of projects and groups before considering dependencies.
     */
    applyInitialFiltering() {
        const matchedReleaseGroups = [];
        for (const releaseGroup of this.releaseGroups) {
            // If group filter is applied and this group doesn't match, skip it entirely
            if (this.filters.groups?.length &&
                !this.filters.groups.includes(releaseGroup.name)) {
                continue;
            }
            // If filtering by groups (not projects), include ALL projects in the matched group
            if (this.filters.groups?.length && !this.filters.projects?.length) {
                this.releaseGroupToFilteredProjects.set(releaseGroup, new Set(releaseGroup.projects));
                matchedReleaseGroups.push(releaseGroup);
                continue;
            }
            // If filtering by projects, filter down to matching projects
            const filteredProjects = new Set();
            for (const project of releaseGroup.projects) {
                if (this.filters.projects?.length &&
                    !this.filters.projects.includes(project)) {
                    continue;
                }
                filteredProjects.add(project);
            }
            // If no filters applied or group has matching projects, include it
            if (filteredProjects.size > 0 || !this.hasAnyFilters()) {
                const projectsToInclude = filteredProjects.size > 0
                    ? filteredProjects
                    : new Set(releaseGroup.projects);
                this.releaseGroupToFilteredProjects.set(releaseGroup, projectsToInclude);
                matchedReleaseGroups.push(releaseGroup);
            }
        }
        // Update this.releaseGroups to only include matched groups
        if (this.hasAnyFilters()) {
            this.releaseGroups = matchedReleaseGroups;
        }
    }
    /**
     * Check if any filters are applied
     */
    hasAnyFilters() {
        return !!(this.filters.projects?.length || this.filters.groups?.length);
    }
    /**
     * Setup projects to process and resolve version actions
     */
    async setupProjectsToProcess(options) {
        const { tree, projectGraph, nxReleaseConfig, filters, firstRelease, versionActionsOptionsOverrides, } = options;
        let projectsToProcess = new Set();
        const resolveVersionActionsForProjectCallbacks = [];
        // Precompute all projects in nx release config
        for (const [groupName, group] of Object.entries(nxReleaseConfig.groups)) {
            for (const project of group.projects) {
                this.allProjectsConfiguredForNxRelease.add(project);
                this.projectLoggers.set(project, new project_logger_1.ProjectLogger(project));
                if (filters.groups?.includes(groupName)) {
                    projectsToProcess.add(project);
                }
                else if (filters.projects?.includes(project)) {
                    projectsToProcess.add(project);
                }
                const projectGraphNode = projectGraph.nodes[project];
                const releaseGroup = this.projectToReleaseGroup.get(project);
                const finalConfigForProject = ReleaseGraph.resolveFinalConfigForProject(releaseGroup, projectGraphNode, firstRelease, versionActionsOptionsOverrides);
                this.finalConfigsByProject.set(project, finalConfigForProject);
                resolveVersionActionsForProjectCallbacks.push(async () => {
                    const { versionActionsPath, versionActions, afterAllProjectsVersioned, } = await (0, version_actions_1.resolveVersionActionsForProject)(tree, releaseGroup, projectGraphNode, finalConfigForProject);
                    if (!this.uniqueAfterAllProjectsVersioned.has(versionActionsPath)) {
                        this.uniqueAfterAllProjectsVersioned.set(versionActionsPath, afterAllProjectsVersioned);
                    }
                    let versionActionsToUse = versionActions;
                    const shouldSkip = (0, shared_1.shouldSkipVersionActions)(finalConfigForProject.dockerOptions, project);
                    if (shouldSkip) {
                        versionActionsToUse = new version_actions_1.NOOP_VERSION_ACTIONS(releaseGroup, projectGraphNode, finalConfigForProject);
                    }
                    this.projectsToVersionActions.set(project, versionActionsToUse);
                });
            }
        }
        if (!filters.groups?.length && !filters.projects?.length) {
            projectsToProcess = this.allProjectsConfiguredForNxRelease;
        }
        if (projectsToProcess.size === 0) {
            throw new Error('No projects are set to be processed, please report this as a bug on https://github.com/nrwl/nx/issues');
        }
        this.allProjectsToProcess = new Set(projectsToProcess);
        for (const cb of resolveVersionActionsForProjectCallbacks) {
            await cb();
        }
    }
    /**
     * Precompute dependency relationships between all projects
     */
    async precomputeDependencyRelationships(tree, projectGraph) {
        for (const projectName of this.allProjectsConfiguredForNxRelease) {
            const versionActions = this.projectsToVersionActions.get(projectName);
            if (!this.projectToDependencies.has(projectName)) {
                this.projectToDependencies.set(projectName, new Set());
            }
            const deps = await versionActions.readDependencies(tree, projectGraph);
            for (const dep of deps) {
                if (!this.allProjectsConfiguredForNxRelease.has(dep.target)) {
                    continue;
                }
                this.projectToDependencies.get(projectName).add(dep.target);
                if (!this.projectToDependents.has(dep.target)) {
                    this.projectToDependents.set(dep.target, new Set());
                }
                this.projectToDependents.get(dep.target).add(projectName);
            }
        }
    }
    /**
     * Apply dependency-aware filtering that considers updateDependents configuration.
     * This includes transitive dependents based on updateDependents setting ('always' by default, or 'auto').
     */
    applyDependencyAwareFiltering() {
        // Track the original filtered projects before adding dependents
        this.originalFilteredProjects = new Set(this.allProjectsToProcess);
        if (!this.hasAnyFilters()) {
            // No filtering applied, nothing to do
            return;
        }
        // Validate filtering against fixed release groups
        this.validateFilterAgainstFixedGroups();
        // Find all dependents that need to be included based on updateDependents setting
        this.findDependentsToProcess();
        // Generate user-friendly filter log
        this.generateFilterLog();
    }
    /**
     * Validate that the filter doesn't try to isolate projects in fixed release groups
     */
    validateFilterAgainstFixedGroups() {
        if (!this.filters.projects?.length) {
            // Group filtering doesn't have this issue
            return;
        }
        for (const releaseGroup of this.releaseGroups) {
            if (releaseGroup.projectsRelationship !== 'fixed') {
                continue;
            }
            const filteredProjectsInGroup = releaseGroup.projects.filter((p) => this.releaseGroupToFilteredProjects.get(releaseGroup)?.has(p));
            if (filteredProjectsInGroup.length > 0 &&
                filteredProjectsInGroup.length < releaseGroup.projects.length) {
                throw new Error(`Cannot filter to a subset of projects within fixed release group "${releaseGroup.name}". ` +
                    `Filtered projects: [${filteredProjectsInGroup.join(', ')}], ` +
                    `All projects in group: [${releaseGroup.projects.join(', ')}]. ` +
                    `Either filter to all projects in the group, use --groups to filter by group, or change the group to "independent".`);
            }
        }
    }
    /**
     * Find dependents that should be included in processing based on updateDependents configuration
     */
    findDependentsToProcess() {
        const projectsToProcess = Array.from(this.allProjectsToProcess);
        const allTrackedDependents = new Set();
        const dependentsToProcess = new Set();
        const additionalGroups = new Map();
        // BFS traversal to find all transitive dependents
        let currentLevel = [...projectsToProcess];
        while (currentLevel.length > 0) {
            const nextLevel = [];
            const dependents = this.getAllNonImplicitDependents(currentLevel);
            for (const dep of dependents) {
                if (allTrackedDependents.has(dep) ||
                    this.allProjectsToProcess.has(dep)) {
                    continue;
                }
                allTrackedDependents.add(dep);
                // Check if this dependent should be included based on updateDependents settings
                const depUpdateDependentsSetting = this.projectToUpdateDependentsSetting.get(dep);
                // Only include if dependent has 'always' or 'auto' (not 'never')
                if (depUpdateDependentsSetting !== 'never') {
                    // Find which project(s) in currentLevel this dependent depends on
                    const shouldIncludeDependent = currentLevel.some((proj) => {
                        const projUpdateSetting = this.projectToUpdateDependentsSetting.get(proj);
                        const projDependents = this.getProjectDependents(proj);
                        if (!projDependents.has(dep)) {
                            return false;
                        }
                        // Always include if updateDependents is 'always'
                        if (projUpdateSetting === 'always') {
                            return true;
                        }
                        // For 'auto', include if in the same release group to match historical behavior
                        if (projUpdateSetting === 'auto') {
                            const projGroup = this.getReleaseGroupForProject(proj);
                            const depGroup = this.getReleaseGroupForProject(dep);
                            return projGroup && depGroup && projGroup.name === depGroup.name;
                        }
                        return false;
                    });
                    if (shouldIncludeDependent) {
                        dependentsToProcess.add(dep);
                        // Track the release group of this dependent
                        const depGroup = this.getReleaseGroupForProject(dep);
                        if (depGroup) {
                            // Check if this group is already in our list by name
                            const groupAlreadyExists = this.releaseGroups.some((g) => g.name === depGroup.name);
                            if (!groupAlreadyExists) {
                                additionalGroups.set(depGroup.name, depGroup);
                            }
                        }
                    }
                }
                nextLevel.push(dep);
            }
            currentLevel = nextLevel;
        }
        dependentsToProcess.forEach((dep) => this.allProjectsToProcess.add(dep));
        // Add any additional groups and their filtered projects
        additionalGroups.forEach((group) => {
            // When adding groups due to dependents, clear version plans to avoid duplication
            // Version plans should only be processed for groups that were explicitly included
            const groupForDependents = {
                ...group,
                versionPlans: false,
                resolvedVersionPlans: false,
            };
            this.releaseGroups.push(groupForDependents);
            // Add the projects from this group that are actually being processed
            const projectsInGroup = new Set(group.projects.filter((p) => dependentsToProcess.has(p)));
            this.releaseGroupToFilteredProjects.set(groupForDependents, projectsInGroup);
        });
    }
    /**
     * Generate user-friendly log describing what the filter matched
     */
    generateFilterLog() {
        if (this.filters.projects?.length) {
            // Projects filter - only show the originally filtered projects to match old behavior
            const matchedProjects = Array.from(this.originalFilteredProjects);
            this.filterLog = {
                title: `Your filter "${this.filters.projects.join(',')}" matched the following projects:`,
                bodyLines: matchedProjects.map((p) => {
                    const releaseGroupForProject = this.projectToReleaseGroup.get(p);
                    if (!releaseGroupForProject ||
                        releaseGroupForProject.name === config_1.IMPLICIT_DEFAULT_RELEASE_GROUP) {
                        return `- ${p}`;
                    }
                    return `- ${p} (release group "${releaseGroupForProject.name}")`;
                }),
            };
        }
        // TODO: add groups filter log
    }
    /**
     * Build the group graph structure
     */
    buildGroupGraphStructure() {
        for (const group of this.releaseGroups) {
            // Don't overwrite if already exists (may have been added during filtering)
            if (!this.groupGraph.has(group.name)) {
                this.groupGraph.set(group.name, {
                    group,
                    dependencies: new Set(),
                    dependents: new Set(),
                });
            }
        }
    }
    /**
     * Resolve current versions for all projects that will be processed
     */
    async resolveCurrentVersionsForProjects(tree, projectGraph, preid) {
        for (const [, releaseGroupNode] of this.groupGraph) {
            for (const projectName of releaseGroupNode.group.projects) {
                const projectGraphNode = projectGraph.nodes[projectName];
                if (!this.allProjectsToProcess.has(projectName)) {
                    continue;
                }
                const versionActions = this.projectsToVersionActions.get(projectName);
                const finalConfigForProject = this.finalConfigsByProject.get(projectName);
                let latestMatchingGitTag;
                const releaseTagPattern = releaseGroupNode.group.releaseTag.pattern;
                if (finalConfigForProject.currentVersionResolver === 'git-tag') {
                    latestMatchingGitTag = await (0, git_1.getLatestGitTagForPattern)(releaseTagPattern, {
                        projectName: (0, git_1.sanitizeProjectNameForGitTag)(projectGraphNode.name),
                        releaseGroupName: releaseGroupNode.group.name,
                    }, this.resolveRepositoryTags.bind(this), {
                        checkAllBranchesWhen: releaseGroupNode.group.releaseTag.checkAllBranchesWhen,
                        preid: preid,
                        requireSemver: releaseGroupNode.group.releaseTag.requireSemver,
                        strictPreid: releaseGroupNode.group.releaseTag.strictPreid,
                    });
                    this.cachedLatestMatchingGitTag.set(projectName, latestMatchingGitTag);
                }
                const currentVersion = await (0, resolve_current_version_1.resolveCurrentVersion)(tree, projectGraphNode, releaseGroupNode.group, versionActions, this.projectLoggers.get(projectName), this.currentVersionsPerFixedReleaseGroup, finalConfigForProject, releaseTagPattern, latestMatchingGitTag);
                this.cachedCurrentVersions.set(projectName, currentVersion);
            }
        }
    }
    /**
     * Build dependency relationships between release groups
     */
    buildGroupDependencyGraph() {
        for (const [releaseGroupName, releaseGroupNode] of this.groupGraph) {
            for (const projectName of releaseGroupNode.group.projects) {
                const projectDeps = this.getProjectDependencies(projectName);
                for (const dep of projectDeps) {
                    const dependencyGroup = this.getReleaseGroupNameForProject(dep);
                    if (dependencyGroup && dependencyGroup !== releaseGroupName) {
                        releaseGroupNode.dependencies.add(dependencyGroup);
                        // Only add to dependents if the dependency group exists in the graph
                        // (it may have been filtered out due to user filters)
                        const dependencyGroupNode = this.groupGraph.get(dependencyGroup);
                        if (dependencyGroupNode) {
                            dependencyGroupNode.dependents.add(releaseGroupName);
                        }
                    }
                }
            }
        }
    }
    /**
     * Topologically sort release groups
     */
    topologicallySortReleaseGroups() {
        const groupNames = Array.from(this.groupGraph.keys());
        const getGroupDependencies = (groupName) => {
            const groupNode = this.groupGraph.get(groupName);
            if (!groupNode) {
                return [];
            }
            return Array.from(groupNode.dependencies);
        };
        return (0, topological_sort_1.topologicalSort)(groupNames, getGroupDependencies);
    }
    /**
     * Topologically sort projects within a release group
     */
    topologicallySortProjects(releaseGroup) {
        const projects = releaseGroup.projects.filter((p) => this.allProjectsToProcess.has(p));
        const getProjectDependenciesInSameGroup = (project) => {
            const deps = this.getProjectDependencies(project);
            return Array.from(deps).filter((dep) => this.getReleaseGroupNameForProject(dep) === releaseGroup.name &&
                this.allProjectsToProcess.has(dep));
        };
        return (0, topological_sort_1.topologicalSort)(projects, getProjectDependenciesInSameGroup);
    }
    async populateDependentProjectsData(tree, projectGraph) {
        // Populate detailed dependent projects data for all projects being processed
        for (const projectName of this.allProjectsToProcess) {
            const dependentProjectNames = Array.from(this.getProjectDependents(projectName)).filter((dep) => this.allProjectsConfiguredForNxRelease.has(dep));
            const dependentProjectsData = [];
            for (const dependentProjectName of dependentProjectNames) {
                const versionActions = this.projectsToVersionActions.get(dependentProjectName);
                const { currentVersion, dependencyCollection } = await versionActions.readCurrentVersionOfDependency(tree, projectGraph, projectName);
                dependentProjectsData.push({
                    source: dependentProjectName,
                    target: projectName,
                    type: 'static',
                    dependencyCollection,
                    rawVersionSpec: currentVersion,
                });
            }
            this.originalDependentProjectsPerProject.set(projectName, dependentProjectsData);
        }
    }
    /**
     * Get all non-implicit dependents for a set of projects
     */
    getAllNonImplicitDependents(projects) {
        return projects
            .flatMap((project) => Array.from(this.getProjectDependents(project)))
            .filter((dep) => !this.allProjectsToProcess.has(dep));
    }
    /**
     * Resolve final configuration for a project
     *
     * NOTE: We are providing ultimate fallback values via ?? here mainly just to keep TypeScript happy.
     * All default values should have been applied by this point by config.ts but the types can't know
     * that for sure at this point.
     */
    static resolveFinalConfigForProject(releaseGroup, projectGraphNode, firstRelease, versionActionsOptionsOverrides) {
        const releaseGroupVersionConfig = releaseGroup.version;
        const projectVersionConfig = projectGraphNode.data.release?.version;
        const projectDockerConfig = projectGraphNode.data.release?.docker;
        /**
         * specifierSource
         *
         * If the user has provided a specifier, it always takes precedence,
         * so the effective specifier source is 'prompt', regardless of what
         * the project or release group config says.
         */
        const specifierSource = projectVersionConfig?.specifierSource ??
            releaseGroupVersionConfig?.specifierSource ??
            'prompt';
        /**
         * versionPrefix, defaults to auto
         */
        const versionPrefix = projectVersionConfig?.versionPrefix ??
            releaseGroupVersionConfig?.versionPrefix ??
            'auto';
        if (versionPrefix && !exports.validReleaseVersionPrefixes.includes(versionPrefix)) {
            throw new Error(`Invalid value for versionPrefix: "${versionPrefix}"

Valid values are: ${exports.validReleaseVersionPrefixes
                .map((s) => `"${s}"`)
                .join(', ')}`);
        }
        /**
         * Merge docker options configured in project with release group config,
         * project level configuration should take precedence
         */
        const dockerOptions = Object.assign({}, releaseGroup.docker || {}, projectDockerConfig || {});
        /**
         * currentVersionResolver, defaults to disk
         */
        let currentVersionResolver = projectVersionConfig?.currentVersionResolver ??
            releaseGroupVersionConfig?.currentVersionResolver ??
            'disk';
        // Check if this project should skip version actions based on docker configuration
        const shouldSkip = (0, shared_1.shouldSkipVersionActions)(dockerOptions, projectGraphNode.name);
        if (shouldSkip) {
            // If the project skips version actions, it doesn't need to resolve a current version
            currentVersionResolver = 'none';
        }
        else if (specifierSource === 'conventional-commits' &&
            currentVersionResolver !== 'git-tag') {
            throw new Error(`Invalid currentVersionResolver "${currentVersionResolver}" provided for project "${projectGraphNode.name}". Must be "git-tag" when "specifierSource" is "conventional-commits"`);
        }
        /**
         * currentVersionResolverMetadata, defaults to {}
         */
        const currentVersionResolverMetadata = projectVersionConfig?.currentVersionResolverMetadata ??
            releaseGroupVersionConfig?.currentVersionResolverMetadata ??
            {};
        /**
         * preserveLocalDependencyProtocols
         *
         * This was false by default in legacy versioning, but is true by default now.
         */
        const preserveLocalDependencyProtocols = projectVersionConfig?.preserveLocalDependencyProtocols ??
            releaseGroupVersionConfig?.preserveLocalDependencyProtocols ??
            true;
        /**
         * preserveMatchingDependencyRanges
         *
         * This was false by default until v22, but is true by default now.
         */
        const preserveMatchingDependencyRanges = projectVersionConfig?.preserveMatchingDependencyRanges ??
            releaseGroupVersionConfig?.preserveMatchingDependencyRanges ??
            true;
        /**
         * adjustSemverBumpsForZeroMajorVersion
         *
         * TODO(v23): change the default value of this to true
         * This is false by default for backward compatibility.
         */
        const adjustSemverBumpsForZeroMajorVersion = projectVersionConfig?.adjustSemverBumpsForZeroMajorVersion ??
            releaseGroupVersionConfig?.adjustSemverBumpsForZeroMajorVersion ??
            false;
        /**
         * applyPreidToDependents
         *
         * Defaults to false to preserve the long-standing behavior where dependents
         * of a prerelease-bumped project get a stable patch bump unless opted in.
         */
        const applyPreidToDependents = projectVersionConfig?.applyPreidToDependents ??
            releaseGroupVersionConfig?.applyPreidToDependents ??
            false;
        /**
         * fallbackCurrentVersionResolver, defaults to disk when performing a first release, otherwise undefined
         */
        const fallbackCurrentVersionResolver = projectVersionConfig?.fallbackCurrentVersionResolver ??
            releaseGroupVersionConfig?.fallbackCurrentVersionResolver ??
            (firstRelease ? 'disk' : undefined);
        /**
         * versionActionsOptions, defaults to {}
         */
        let versionActionsOptions = projectVersionConfig?.versionActionsOptions ??
            releaseGroupVersionConfig?.versionActionsOptions ??
            {};
        // Apply any optional overrides that may be passed in from the programmatic API
        versionActionsOptions = {
            ...versionActionsOptions,
            ...(versionActionsOptionsOverrides ?? {}),
        };
        const manifestRootsToUpdate = (projectVersionConfig?.manifestRootsToUpdate ??
            releaseGroupVersionConfig?.manifestRootsToUpdate ??
            []).map((manifestRoot) => {
            if (typeof manifestRoot === 'string') {
                return {
                    path: manifestRoot,
                    // Apply the project level preserveLocalDependencyProtocols setting that was already resolved
                    preserveLocalDependencyProtocols,
                };
            }
            return manifestRoot;
        });
        return {
            specifierSource,
            currentVersionResolver,
            currentVersionResolverMetadata,
            fallbackCurrentVersionResolver,
            versionPrefix,
            preserveLocalDependencyProtocols,
            preserveMatchingDependencyRanges,
            adjustSemverBumpsForZeroMajorVersion,
            applyPreidToDependents,
            versionActionsOptions,
            manifestRootsToUpdate,
            dockerOptions,
        };
    }
    /**
     * Get the release group for a given project
     */
    getReleaseGroupForProject(projectName) {
        return this.projectToReleaseGroup.get(projectName);
    }
    /**
     * Get the release group name for a given project
     */
    getReleaseGroupNameForProject(projectName) {
        const group = this.projectToReleaseGroup.get(projectName);
        return group ? group.name : null;
    }
    /**
     * Get the dependencies of a project
     */
    getProjectDependencies(projectName) {
        return this.projectToDependencies.get(projectName) || new Set();
    }
    /**
     * Get the dependents of a project (projects that depend on it)
     */
    getProjectDependents(projectName) {
        return this.projectToDependents.get(projectName) || new Set();
    }
    /**
     * Get the version actions for a project
     */
    getVersionActionsForProject(projectName) {
        return this.projectsToVersionActions.get(projectName);
    }
    /**
     * Check if a project will be processed
     */
    isProjectToProcess(projectName) {
        return this.allProjectsToProcess.has(projectName);
    }
    async resolveAffectedFilesPerCommitInProjectGraph(commit, projectGraph) {
        // Try to get the graph associated with the commit shortHash
        // if not available, calculate it and store it in the cache
        const { shortHash } = commit;
        let affectedGraph = this.affectedGraphPerCommit.get(shortHash);
        if (affectedGraph) {
            return affectedGraph;
        }
        // Convert affectedFiles to FileChange[] format with proper diff computation
        const touchedFiles = (0, file_utils_1.calculateFileChanges)(commit.affectedFiles, {
            base: `${commit.shortHash}^`,
            head: commit.shortHash,
        });
        // Use the same affected detection logic as `nx affected`
        affectedGraph = await (0, affected_project_graph_1.filterAffected)(projectGraph, touchedFiles);
        this.affectedGraphPerCommit.set(shortHash, affectedGraph);
        return affectedGraph;
    }
    async resolveRepositoryTags(resolveTagsWhen) {
        return this.repositoryGitTags.resolveTags(resolveTagsWhen);
    }
    /**
     * Runs validation on resolved VersionActions instances. E.g. check that manifest files exist for all projects that will be processed.
     * This should be called after preVersionCommand has run, as those commands may create manifest files that are needed for versioning.
     */
    async validate(tree) {
        const validationPromises = [];
        for (const projectName of this.allProjectsToProcess) {
            const versionActions = this.projectsToVersionActions.get(projectName);
            if (versionActions) {
                validationPromises.push(versionActions.validate(tree));
            }
        }
        // Validate in parallel
        await Promise.all(validationPromises);
    }
}
exports.ReleaseGraph = ReleaseGraph;
/**
 * Creates a complete release graph by analyzing all release groups, projects, and their relationships.
 *
 * This function builds the graph structure, applies filtering logic that considers dependencies
 * and updateDependents configuration, and caches all necessary data.
 *
 * The returned graph can be reused across versioning, changelog, and publishing operations.
 */
async function createReleaseGraph(options) {
    // Construct ReleaseGroupWithName objects from nxReleaseConfig
    const releaseGroups = Object.entries(options.nxReleaseConfig.groups).map(([name, group]) => {
        return {
            ...group,
            name,
            resolvedVersionPlans: group.versionPlans ? [] : false,
        };
    });
    const graph = new ReleaseGraph(releaseGroups, options.filters);
    await graph.init(options);
    return graph;
}
