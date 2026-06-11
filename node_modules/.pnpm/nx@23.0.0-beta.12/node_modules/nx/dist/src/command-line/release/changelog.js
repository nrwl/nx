"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releaseChangelogCLIHandler = void 0;
exports.createAPI = createAPI;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const enquirer_1 = require("enquirer");
const node_fs_1 = require("node:fs");
const semver_1 = require("semver");
const tmp_1 = require("tmp");
const nx_json_1 = require("../../config/nx-json");
const tree_1 = require("../../generators/tree");
const file_map_utils_1 = require("../../project-graph/file-map-utils");
const project_graph_1 = require("../../project-graph/project-graph");
const utils_1 = require("../../tasks-runner/utils");
const handle_errors_1 = require("../../utils/handle-errors");
const is_ci_1 = require("../../utils/is-ci");
const output_1 = require("../../utils/output");
const path_1 = require("../../utils/path");
const workspace_root_1 = require("../../utils/workspace-root");
const commit_utils_1 = require("./changelog/commit-utils");
const version_plan_filtering_1 = require("./changelog/version-plan-filtering");
const version_plan_utils_1 = require("./changelog/version-plan-utils");
const config_1 = require("./config/config");
const deep_merge_json_1 = require("./config/deep-merge-json");
const version_plans_1 = require("./config/version-plans");
const git_1 = require("./utils/git");
const launch_editor_1 = require("./utils/launch-editor");
const markdown_1 = require("./utils/markdown");
const print_changes_1 = require("./utils/print-changes");
const print_config_1 = require("./utils/print-config");
const release_graph_1 = require("./utils/release-graph");
const remote_release_client_1 = require("./utils/remote-release-clients/remote-release-client");
const resolve_changelog_renderer_1 = require("./utils/resolve-changelog-renderer");
const resolve_nx_json_error_message_1 = require("./utils/resolve-nx-json-error-message");
const shared_1 = require("./utils/shared");
const version_plan_utils_2 = require("./utils/version-plan-utils");
const releaseChangelogCLIHandler = (args) => (0, handle_errors_1.handleErrors)(args.verbose, () => createAPI({}, false)(args));
exports.releaseChangelogCLIHandler = releaseChangelogCLIHandler;
function createAPI(overrideReleaseConfig, ignoreNxJsonConfig) {
    /**
     * NOTE: This function is also exported for programmatic usage and forms part of the public API
     * of Nx. We intentionally do not wrap the implementation with handleErrors because users need
     * to have control over their own error handling when using the API.
     */
    return async function releaseChangelog(args) {
        const projectGraph = await (0, project_graph_1.createProjectGraphAsync)({ exitOnError: true });
        const overriddenConfig = overrideReleaseConfig ?? {};
        const userProvidedReleaseConfig = ignoreNxJsonConfig
            ? overriddenConfig
            : (0, deep_merge_json_1.deepMergeJson)((0, nx_json_1.readNxJson)().release ?? {}, overriddenConfig);
        // Apply default configuration to any optional user configuration
        const { error: configError, nxReleaseConfig } = await (0, config_1.createNxReleaseConfig)(projectGraph, await (0, file_map_utils_1.createProjectFileMapUsingProjectGraph)(projectGraph), userProvidedReleaseConfig);
        if (configError) {
            return await (0, config_1.handleNxReleaseConfigError)(configError);
        }
        // --print-config exits directly as it is not designed to be combined with any other programmatic operations
        if (args.printConfig) {
            return (0, print_config_1.printConfigAndExit)({
                userProvidedReleaseConfig,
                nxReleaseConfig,
                isDebug: args.printConfig === 'debug',
            });
        }
        // The nx release top level command will always override these three git args. This is how we can tell
        // if the top level release command was used or if the user is using the changelog subcommand.
        // If the user explicitly overrides these args, then it doesn't matter if the top level config is set,
        // as all of the git options would be overridden anyway.
        if ((args.gitCommit === undefined ||
            args.gitTag === undefined ||
            args.stageChanges === undefined) &&
            userProvidedReleaseConfig.git) {
            const nxJsonMessage = await (0, resolve_nx_json_error_message_1.resolveNxJsonConfigErrorMessage)([
                'release',
                'git',
            ]);
            output_1.output.error({
                title: `The "release.git" property in nx.json may not be used with the "nx release changelog" subcommand or programmatic API. Instead, configure git options for subcommands directly with "release.version.git" and "release.changelog.git".`,
                bodyLines: [nxJsonMessage],
            });
            process.exit(1);
        }
        const tree = new tree_1.FsTree(workspace_root_1.workspaceRoot, args.verbose);
        // Use pre-built release graph if provided, otherwise create a new one
        const releaseGraph = args.releaseGraph ||
            (await (0, release_graph_1.createReleaseGraph)({
                tree,
                projectGraph,
                nxReleaseConfig,
                filters: {
                    projects: args.projects,
                    groups: args.groups,
                },
                firstRelease: args.firstRelease,
                verbose: args.verbose,
            }));
        // Display filter log if filters were applied (only when graph was created, not reused)
        if (!args.releaseGraph &&
            releaseGraph.filterLog &&
            process.env.NX_RELEASE_INTERNAL_SUPPRESS_FILTER_LOG !== 'true') {
            output_1.output.note(releaseGraph.filterLog);
        }
        let rawVersionPlans = await (0, version_plans_1.readRawVersionPlans)();
        if (args.deleteVersionPlans === undefined) {
            // default to deleting version plans in this command instead of after versioning
            args.deleteVersionPlans = true;
        }
        const changelogGenerationEnabled = !!nxReleaseConfig.changelog.workspaceChangelog ||
            Object.values(nxReleaseConfig.groups).some((g) => g.changelog);
        if (!changelogGenerationEnabled) {
            output_1.output.warn({
                title: `Changelogs are disabled. No changelog entries will be generated`,
                bodyLines: [
                    `To explicitly enable changelog generation, configure "release.changelog.workspaceChangelog" or "release.changelog.projectChangelogs" in nx.json.`,
                ],
            });
            return {};
        }
        const useAutomaticFromRef = nxReleaseConfig.changelog?.automaticFromRef || args.firstRelease;
        /**
         * For determining the versions to use within changelog files, there are a few different possibilities:
         * - the user is using the nx CLI, and therefore passes a single --version argument which represents the version for any and all changelog
         * files which will be generated (i.e. both the workspace changelog, and all project changelogs, depending on which of those has been enabled)
         * - the user is using the nxReleaseChangelog API programmatically, and:
         *   - passes only a version property
         *     - this works in the same way as described above for the CLI
         *   - passes only a versionData object
         *     - this is a special case where the user is providing a version for each project, and therefore the version argument is not needed
         *     - NOTE: it is not possible to generate a workspace level changelog with only a versionData object, and this will produce an error
         *   - passes both a version and a versionData object
         *     - in this case, the version property will be used as the reference for the workspace changelog, and the versionData object will be used
         *    to generate project changelogs
         */
        const { workspaceChangelogVersion, projectsVersionData } = resolveChangelogVersions(args, releaseGraph);
        const to = args.to || 'HEAD';
        const toSHA = await (0, git_1.getCommitHash)(to);
        const headSHA = to === 'HEAD' ? toSHA : await (0, git_1.getCommitHash)('HEAD');
        // Resolve the from SHA once for reuse across different contexts
        const fromSHA = await (0, version_plan_filtering_1.resolveWorkspaceChangelogFromSHA)({
            args,
            nxReleaseConfig,
            useAutomaticFromRef,
            resolveRepositoryTags: releaseGraph.resolveRepositoryTags.bind(releaseGraph),
        });
        // Filter version plans based on resolveVersionPlans option
        const shouldFilterVersionPlans = args.resolveVersionPlans === 'using-from-and-to';
        if (shouldFilterVersionPlans && rawVersionPlans.length > 0 && fromSHA) {
            rawVersionPlans = await (0, version_plan_filtering_1.filterVersionPlansByCommitRange)(rawVersionPlans, fromSHA, toSHA, args.verbose);
            if (args.verbose) {
                console.log(`Using version plans committed between ${fromSHA} and ${toSHA}`);
            }
        }
        // Set resolved version plans on groups
        await (0, version_plans_1.setResolvedVersionPlansOnGroups)(rawVersionPlans, releaseGraph.releaseGroups, Object.keys(projectGraph.nodes), args.verbose);
        // Validate version plans against the filter after resolution
        const versionPlanValidationError = (0, version_plan_utils_2.validateResolvedVersionPlansAgainstFilter)(releaseGraph.releaseGroups, releaseGraph.releaseGroupToFilteredProjects);
        if (versionPlanValidationError) {
            output_1.output.error(versionPlanValidationError);
            process.exit(1);
        }
        /**
         * Extract the preid from the workspace version and the project versions
         */
        const workspacePreid = workspaceChangelogVersion
            ? extractPreid(workspaceChangelogVersion)
            : undefined;
        const projectsPreid = Object.fromEntries(Object.entries(projectsVersionData).map(([projectName, v]) => [
            projectName,
            v.newVersion ? extractPreid(v.newVersion) : undefined,
        ]));
        /**
         * Protect the user against attempting to create a new commit when recreating an old release changelog,
         * this seems like it would always be unintentional.
         */
        const autoCommitEnabled = args.gitCommit ?? nxReleaseConfig.changelog.git.commit;
        if (autoCommitEnabled && headSHA !== toSHA) {
            throw new Error(`You are attempting to recreate the changelog for an old release, but you have enabled auto-commit mode. Please disable auto-commit mode by updating your nx.json, or passing --git-commit=false`);
        }
        const commitMessage = args.gitCommitMessage || nxReleaseConfig.changelog.git.commitMessage;
        const commitMessageValues = (0, shared_1.createCommitMessageValues)(releaseGraph.releaseGroups, releaseGraph.releaseGroupToFilteredProjects, projectsVersionData, commitMessage);
        // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
        const gitTagValues = (args.gitTag ?? nxReleaseConfig.changelog.git.tag)
            ? (0, shared_1.createGitTagValues)(releaseGraph.releaseGroups, releaseGraph.releaseGroupToFilteredProjects, projectsVersionData)
            : [];
        (0, shared_1.handleDuplicateGitTags)(gitTagValues);
        const postGitTasks = [];
        const workspaceChangelogChanges = await resolveWorkspaceChangelogChanges({
            releaseGraph,
            nxReleaseConfig,
            args,
            workspacePreid,
            projectsPreid,
            useAutomaticFromRef,
            toSHA,
            fromSHA,
        });
        const workspaceChangelog = await generateChangelogForWorkspace({
            tree,
            args,
            nxReleaseConfig,
            workspaceChangelogVersion,
            changes: workspaceChangelogChanges,
        });
        // Add the post git task (e.g. create a remote release) for the workspace changelog, if applicable
        if (workspaceChangelog && workspaceChangelog.postGitTask) {
            postGitTasks.push(workspaceChangelog.postGitTask);
        }
        /**
         * Create a cache for from SHA resolution to avoid duplicate git operations
         */
        const fromSHACache = new Map();
        // Cache the workspace from SHA if available
        if (fromSHA) {
            fromSHACache.set('workspace', fromSHA);
        }
        // Helper function to get cached from SHA or resolve and cache it
        const getCachedFromSHA = async (cacheKey, pattern, templateValues, preid, checkAllBranchesWhen, requireSemver, strictPreid) => {
            if (fromSHACache.has(cacheKey)) {
                return fromSHACache.get(cacheKey);
            }
            const sha = await (0, version_plan_filtering_1.resolveChangelogFromSHA)({
                fromRef: args.from,
                tagPattern: pattern,
                tagPatternValues: templateValues,
                resolveRepositoryTags: releaseGraph.resolveRepositoryTags.bind(releaseGraph),
                checkAllBranchesWhen,
                preid,
                requireSemver,
                strictPreid,
                useAutomaticFromRef,
            });
            fromSHACache.set(cacheKey, sha);
            return sha;
        };
        /**
         * Compute any additional dependency bumps up front because there could be cases of circular dependencies,
         * and figuring them out during the main iteration would be too late.
         */
        const projectToAdditionalDependencyBumps = new Map();
        for (const releaseGroup of releaseGraph.releaseGroups) {
            if (releaseGroup.projectsRelationship !== 'independent') {
                continue;
            }
            for (const project of releaseGroup.projects) {
                // If the project does not have any changes, do not process its dependents
                if (!projectsVersionData[project] ||
                    projectsVersionData[project].newVersion === null) {
                    continue;
                }
                const dependentProjects = (projectsVersionData[project].dependentProjects || [])
                    .map((dep) => {
                    return {
                        dependencyName: dep.source,
                        newVersion: projectsVersionData[dep.source]?.newVersion ?? null,
                    };
                })
                    .filter((b) => b.newVersion !== null);
                for (const dependent of dependentProjects) {
                    const additionalDependencyBumpsForProject = projectToAdditionalDependencyBumps.has(dependent.dependencyName)
                        ? projectToAdditionalDependencyBumps.get(dependent.dependencyName)
                        : [];
                    additionalDependencyBumpsForProject.push({
                        dependencyName: project,
                        newVersion: projectsVersionData[project].newVersion,
                    });
                    projectToAdditionalDependencyBumps.set(dependent.dependencyName, additionalDependencyBumpsForProject);
                }
            }
        }
        const allProjectChangelogs = {};
        for (const releaseGroup of releaseGraph.releaseGroups) {
            const config = releaseGroup.changelog;
            // The entire feature is disabled at the release group level, exit early
            if (config === false) {
                continue;
            }
            const projects = args.projects?.length
                ? // If the user has passed a list of projects, we need to use the filtered list of projects within the release group, plus any dependents
                    Array.from(new Set(Array.from(releaseGraph.releaseGroupToFilteredProjects.get(releaseGroup)).flatMap((project) => {
                        return [
                            project,
                            ...(projectsVersionData[project]?.dependentProjects.map((dep) => dep.source) || []),
                        ];
                    })))
                : // Otherwise, we use the full list of projects within the release group
                    releaseGroup.projects;
            const projectNodes = projects.map((name) => projectGraph.nodes[name]);
            if (releaseGroup.projectsRelationship === 'independent') {
                for (const project of projectNodes) {
                    let changes = null;
                    if (releaseGroup.resolvedVersionPlans) {
                        changes = (0, version_plan_utils_1.createChangesFromProjectsVersionPlans)(releaseGroup.resolvedVersionPlans, project.name);
                    }
                    else {
                        const projectCacheKey = `${releaseGroup.name}:${project.name}`;
                        const fromSHA = await getCachedFromSHA(projectCacheKey, releaseGroup.releaseTag.pattern, {
                            projectName: project.name,
                            releaseGroupName: releaseGroup.name,
                        }, projectsPreid[project.name], releaseGroup.releaseTag.checkAllBranchesWhen, releaseGroup.releaseTag.requireSemver, releaseGroup.releaseTag.strictPreid);
                        let commits;
                        let fromRef = fromSHA;
                        if (!fromRef && useAutomaticFromRef) {
                            // For automatic from ref, we already have it cached
                            fromRef = fromSHACache.get(projectCacheKey);
                            if (fromRef) {
                                commits = await filterProjectCommits({
                                    fromSHA: fromRef,
                                    toSHA,
                                    projectPath: project.data.root,
                                });
                                fromRef = commits[0]?.shortHash;
                                if (args.verbose) {
                                    console.log(`Determined --from ref for ${project.name} from the first commit in which it exists: ${fromRef}`);
                                }
                            }
                        }
                        if (!fromRef && !commits) {
                            throw new Error(`Unable to determine the previous git tag. If this is the first release of your workspace, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTag.pattern" property in nx.json to match the structure of your repository's git tags.`);
                        }
                        if (!commits) {
                            commits = await filterProjectCommits({
                                fromSHA: fromRef,
                                toSHA,
                                projectPath: project.data.root,
                            });
                        }
                        const { fileMap } = await (0, file_map_utils_1.createFileMapUsingProjectGraph)(projectGraph);
                        const fileToProjectMap = (0, commit_utils_1.createFileToProjectMap)(fileMap.projectFileMap);
                        changes = (0, commit_utils_1.createChangesFromCommits)(commits, fileMap, fileToProjectMap, nxReleaseConfig.conventionalCommits);
                    }
                    const projectChangelogs = await generateChangelogForProjects({
                        tree,
                        args,
                        changes,
                        projectsVersionData,
                        releaseGroup,
                        projects: [project],
                        nxReleaseConfig,
                        projectToAdditionalDependencyBumps,
                    });
                    if (projectChangelogs) {
                        for (const [projectName, projectChangelog] of Object.entries(projectChangelogs)) {
                            // Add the post git task (e.g. create a remote release) for the project changelog, if applicable
                            if (projectChangelog.postGitTask) {
                                postGitTasks.push(projectChangelog.postGitTask);
                            }
                            allProjectChangelogs[projectName] = projectChangelog;
                        }
                    }
                }
            }
            else {
                let changes = [];
                if (releaseGroup.resolvedVersionPlans) {
                    // This is identical to workspace changelog for fixed groups
                    changes = (0, version_plan_utils_1.createChangesFromGroupVersionPlans)(releaseGroup.resolvedVersionPlans);
                }
                else {
                    const groupCacheKey = `${releaseGroup.name}:fixed`;
                    const fromSHA = await getCachedFromSHA(groupCacheKey, releaseGroup.releaseTag.pattern, {}, workspacePreid ?? projectsPreid?.[Object.keys(projectsPreid)[0]], releaseGroup.releaseTag.checkAllBranchesWhen, releaseGroup.releaseTag.requireSemver, releaseGroup.releaseTag.strictPreid);
                    if (!fromSHA) {
                        throw new Error(`Unable to determine the previous git tag. If this is the first release of your release group, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTag.pattern" property in nx.json to match the structure of your repository's git tags.`);
                    }
                    if (args.verbose && useAutomaticFromRef && !args.from) {
                        console.log(`Determined release group --from ref from the first commit in the workspace: ${fromSHA}`);
                    }
                    const { fileMap } = await (0, file_map_utils_1.createFileMapUsingProjectGraph)(projectGraph);
                    const fileToProjectMap = (0, commit_utils_1.createFileToProjectMap)(fileMap.projectFileMap);
                    const commits = await getCommits(fromSHA, toSHA);
                    changes = (0, commit_utils_1.createChangesFromCommits)(commits, fileMap, fileToProjectMap, nxReleaseConfig.conventionalCommits);
                }
                const projectChangelogs = await generateChangelogForProjects({
                    tree,
                    args,
                    changes,
                    projectsVersionData,
                    releaseGroup,
                    projects: projectNodes,
                    nxReleaseConfig,
                    projectToAdditionalDependencyBumps,
                });
                if (projectChangelogs) {
                    for (const [projectName, projectChangelog] of Object.entries(projectChangelogs)) {
                        // Add the post git task (e.g. create a remote release) for the project changelog, if applicable
                        if (projectChangelog.postGitTask) {
                            postGitTasks.push(projectChangelog.postGitTask);
                        }
                        allProjectChangelogs[projectName] = projectChangelog;
                    }
                }
            }
        }
        await applyChangesAndExit(args, nxReleaseConfig, tree, toSHA, postGitTasks, commitMessageValues, gitTagValues, releaseGraph);
        return {
            workspaceChangelog,
            projectChangelogs: allProjectChangelogs,
        };
    };
}
function resolveChangelogVersions(args, releaseGraph) {
    if (!args.version && !args.versionData) {
        throw new Error(`You must provide a version string and/or a versionData object.`);
    }
    const versionData = releaseGraph.releaseGroups.reduce((versionData, releaseGroup) => {
        const releaseGroupProjectNames = Array.from(releaseGraph.releaseGroupToFilteredProjects.get(releaseGroup));
        for (const projectName of releaseGroupProjectNames) {
            if (!args.versionData) {
                versionData[projectName] = {
                    dockerVersion: args.version,
                    newVersion: args.version,
                    currentVersion: '', // not relevant within changelog/commit generation
                    dependentProjects: [], // not relevant within changelog/commit generation
                };
                continue;
            }
            /**
             * In the case where a versionData object was provided, we need to make sure all projects are present,
             * otherwise it suggests a filtering mismatch between the version and changelog command invocations.
             */
            if (!args.versionData[projectName]) {
                throw new Error(`The provided versionData object does not contain a version for project "${projectName}". This suggests a filtering mismatch between the version and changelog command invocations. Please ensure that you have used the same "group" or "project" filter between commands.`);
            }
        }
        return versionData;
    }, args.versionData || {});
    return {
        workspaceChangelogVersion: args.version,
        projectsVersionData: versionData,
    };
}
// Can be overridden to something more specific as we resolve the remote release client within nested logic
let remoteReleaseProviderName;
// If already set, and not the same as the remote release client, append
function applyRemoteReleaseProviderName(newRemoteReleaseProviderName) {
    if (remoteReleaseProviderName) {
        if (remoteReleaseProviderName !== newRemoteReleaseProviderName) {
            remoteReleaseProviderName = `${remoteReleaseProviderName}/${newRemoteReleaseProviderName}`;
        }
    }
    else {
        remoteReleaseProviderName = newRemoteReleaseProviderName;
    }
}
async function applyChangesAndExit(args, nxReleaseConfig, tree, toSHA, postGitTasks, commitMessageValues, gitTagValues, releaseGraph) {
    let latestCommit = toSHA;
    const changes = tree.listChanges();
    /**
     * In the case where we are expecting changelog file updates, but there is nothing
     * to flush from the tree, we exit early. This could happen we using conventional
     * commits, for example.
     */
    const changelogFilesEnabled = checkChangelogFilesEnabled(nxReleaseConfig);
    if (changelogFilesEnabled && !changes.length) {
        output_1.output.warn({
            title: `No changes detected for changelogs`,
            bodyLines: [
                `No changes were detected for any changelog files, so no changelog entries will be generated.`,
            ],
        });
        if (!postGitTasks.length) {
            // No post git tasks (e.g. remote release creation) to perform so we can just exit
            return;
        }
        if ((0, is_ci_1.isCI)()) {
            output_1.output.warn({
                title: `Skipped ${remoteReleaseProviderName ?? 'remote'} release creation because no changes were detected for any changelog files.`,
            });
            return;
        }
        /**
         * Prompt the user to see if they want to create a remote release anyway.
         * We know that the user has configured remote releases because we have postGitTasks.
         */
        const shouldCreateRemoteReleaseAnyway = await promptForRemoteRelease();
        if (!shouldCreateRemoteReleaseAnyway) {
            return;
        }
        for (const postGitTask of postGitTasks) {
            await postGitTask(latestCommit);
        }
        return;
    }
    const changedFiles = changes.map((f) => f.path);
    let deletedFiles = [];
    if (args.deleteVersionPlans) {
        const planFiles = new Set();
        releaseGraph.releaseGroups.forEach((group) => {
            const filteredProjects = releaseGraph.releaseGroupToFilteredProjects.get(group);
            if (group.resolvedVersionPlans) {
                // Check each version plan individually to see if it should be deleted
                const plansToDelete = [];
                for (const plan of group.resolvedVersionPlans) {
                    // Only delete if ALL projects in the version plan are being filtered/released
                    if ((0, version_plan_utils_2.areAllVersionPlanProjectsFiltered)(plan, group, filteredProjects)) {
                        plansToDelete.push(plan);
                    }
                }
                // Delete the plans that only affect filtered projects
                plansToDelete.forEach((plan) => {
                    if (!args.dryRun) {
                        (0, node_fs_1.rmSync)(plan.absolutePath, { recursive: true, force: true });
                        if (args.verbose) {
                            console.log(`Removing ${plan.relativePath}`);
                        }
                    }
                    else {
                        if (args.verbose) {
                            console.log(`Would remove ${plan.relativePath}, but --dry-run was set`);
                        }
                    }
                    planFiles.add(plan.relativePath);
                });
            }
        });
        deletedFiles = Array.from(planFiles);
    }
    // Generate a new commit for the changes, if configured to do so
    if (args.gitCommit ?? nxReleaseConfig.changelog.git.commit) {
        await (0, shared_1.commitChanges)({
            changedFiles,
            deletedFiles,
            isDryRun: !!args.dryRun,
            isVerbose: !!args.verbose,
            gitCommitMessages: commitMessageValues,
            gitCommitArgs: args.gitCommitArgs || nxReleaseConfig.changelog.git.commitArgs,
        });
        // Resolve the commit we just made
        latestCommit = await (0, git_1.getCommitHash)('HEAD');
    }
    else if ((args.stageChanges ?? nxReleaseConfig.changelog.git.stageChanges) &&
        changes.length) {
        output_1.output.logSingleLine(`Staging changed files with git`);
        await (0, git_1.gitAdd)({
            changedFiles,
            deletedFiles,
            dryRun: args.dryRun,
            verbose: args.verbose,
        });
    }
    // Generate a one or more git tags for the changes, if configured to do so
    if (args.gitTag ?? nxReleaseConfig.changelog.git.tag) {
        output_1.output.logSingleLine(`Tagging commit with git`);
        for (const tag of gitTagValues) {
            await (0, git_1.gitTag)({
                tag,
                message: args.gitTagMessage || nxReleaseConfig.changelog.git.tagMessage,
                additionalArgs: args.gitTagArgs || nxReleaseConfig.changelog.git.tagArgs,
                dryRun: args.dryRun,
                verbose: args.verbose,
            });
        }
    }
    if (args.gitPush ?? nxReleaseConfig.changelog.git.push) {
        output_1.output.logSingleLine(`Pushing to git remote "${args.gitRemote ?? 'origin'}"`);
        await (0, git_1.gitPush)({
            gitRemote: args.gitRemote,
            dryRun: args.dryRun,
            verbose: args.verbose,
            additionalArgs: args.gitPushArgs || nxReleaseConfig.changelog.git.pushArgs,
        });
    }
    // Run any post-git tasks in series
    for (const postGitTask of postGitTasks) {
        await postGitTask(latestCommit);
    }
    return;
}
async function generateChangelogForWorkspace({ tree, args, nxReleaseConfig, workspaceChangelogVersion, changes, }) {
    const config = nxReleaseConfig.changelog.workspaceChangelog;
    // The entire feature is disabled at the workspace level, exit early
    if (config === false) {
        return;
    }
    // If explicitly null it must mean that no changes were detected (e.g. when using conventional commits), so do nothing
    if (workspaceChangelogVersion === null) {
        return;
    }
    // The user explicitly passed workspaceChangelog=true but does not have a workspace changelog config in nx.json
    if (!config) {
        throw new Error(`Workspace changelog is enabled but no configuration was provided. Please provide a workspaceChangelog object in your nx.json`);
    }
    if (Object.entries(nxReleaseConfig.groups).length > 1) {
        output_1.output.warn({
            title: `Workspace changelog is enabled, but you have multiple release groups configured. This is not supported, so workspace changelog will be disabled.`,
            bodyLines: [
                `A single workspace version cannot be determined when defining multiple release groups because versions can differ between each group.`,
                `Project level changelogs can be enabled with the "release.changelog.projectChangelogs" property.`,
            ],
        });
        return;
    }
    if (Object.values(nxReleaseConfig.groups)[0].projectsRelationship ===
        'independent') {
        output_1.output.warn({
            title: `Workspace changelog is enabled, but you have configured an independent projects relationship. This is not supported, so workspace changelog will be disabled.`,
            bodyLines: [
                `A single workspace version cannot be determined when using independent projects because versions can differ between each project.`,
                `Project level changelogs can be enabled with the "release.changelog.projectChangelogs" property.`,
            ],
        });
        return;
    }
    // Only trigger interactive mode for the workspace changelog if the user explicitly requested it via "all" or "workspace"
    const interactive = args.interactive === 'all' || args.interactive === 'workspace';
    const dryRun = !!args.dryRun;
    const gitRemote = args.gitRemote;
    const ChangelogRendererClass = (0, resolve_changelog_renderer_1.resolveChangelogRenderer)(config.renderer);
    let interpolatedTreePath = config.file || '';
    if (interpolatedTreePath) {
        interpolatedTreePath = (0, utils_1.interpolate)(interpolatedTreePath, {
            projectName: '', // n/a for the workspace changelog
            projectRoot: '', // n/a for the workspace changelog
            workspaceRoot: '', // within the tree, workspaceRoot is the root
        });
    }
    const releaseVersion = new shared_1.ReleaseVersion({
        version: workspaceChangelogVersion,
        releaseTagPattern: nxReleaseConfig.releaseTag.pattern,
        releaseGroupName: Object.keys(nxReleaseConfig.groups)[0],
    });
    if (interpolatedTreePath) {
        const prefix = dryRun ? 'Previewing' : 'Generating';
        output_1.output.log({
            title: `${prefix} an entry in ${interpolatedTreePath} for ${pc.white(releaseVersion.gitTag)}`,
        });
    }
    const remoteReleaseClient = await (0, remote_release_client_1.createRemoteReleaseClient)(config.createRelease, gitRemote);
    applyRemoteReleaseProviderName(remoteReleaseClient.remoteReleaseProviderName);
    const changelogRenderer = new ChangelogRendererClass({
        changes,
        changelogEntryVersion: releaseVersion.rawVersion,
        project: null,
        isVersionPlans: !!nxReleaseConfig.versionPlans,
        entryWhenNoChanges: config.entryWhenNoChanges,
        changelogRenderOptions: config.renderOptions,
        conventionalCommitsConfig: nxReleaseConfig.conventionalCommits,
        remoteReleaseClient,
    });
    let contents = await changelogRenderer.render();
    /**
     * If interactive mode, make the changelog contents available for the user to modify in their editor of choice,
     * in a similar style to git interactive rebases/merges.
     */
    if (interactive) {
        const tmpDir = (0, tmp_1.dirSync)().name;
        const changelogPath = (0, path_1.joinPathFragments)(tmpDir, 
        // Include the tree path in the name so that it is easier to identify which changelog file is being edited
        `PREVIEW__${interpolatedTreePath.replace(/\//g, '_')}`);
        (0, node_fs_1.writeFileSync)(changelogPath, contents);
        await (0, launch_editor_1.launchEditor)(changelogPath);
        contents = (0, node_fs_1.readFileSync)(changelogPath, 'utf-8');
    }
    if (interpolatedTreePath) {
        let rootChangelogContents = tree.exists(interpolatedTreePath)
            ? tree.read(interpolatedTreePath).toString()
            : '';
        if (rootChangelogContents && !args.replaceExistingContents) {
            // NOTE: right now existing releases are always expected to be in markdown format, but in the future we could potentially support others via a custom parser option
            const changelogReleases = (0, markdown_1.parseChangelogMarkdown)(rootChangelogContents).releases;
            const existingVersionToUpdate = changelogReleases.find((r) => r.version === releaseVersion.rawVersion);
            if (existingVersionToUpdate) {
                rootChangelogContents = rootChangelogContents.replace(`## ${releaseVersion.rawVersion}\n\n\n${existingVersionToUpdate.body}`, contents);
            }
            else {
                // No existing version, simply prepend the new release to the top of the file
                rootChangelogContents = `${contents}\n\n${rootChangelogContents}`;
            }
        }
        else {
            // No existing changelog contents, or replaceExistingContents is true, simply use the generated contents directly
            rootChangelogContents = contents;
        }
        tree.write(interpolatedTreePath, rootChangelogContents);
        (0, print_changes_1.printAndFlushChanges)(tree, !!dryRun, 3, false, shared_1.noDiffInChangelogMessage);
    }
    const postGitTask = args.createRelease !== false && config.createRelease
        ? remoteReleaseClient.createPostGitTask(releaseVersion, contents, dryRun)
        : null;
    return {
        releaseVersion,
        contents,
        postGitTask,
    };
}
async function generateChangelogForProjects({ tree, args, changes, projectsVersionData, releaseGroup, projects, nxReleaseConfig, projectToAdditionalDependencyBumps, }) {
    const config = releaseGroup.changelog;
    // The entire feature is disabled at the release group level, exit early
    if (config === false) {
        return;
    }
    // Only trigger interactive mode for the project changelog if the user explicitly requested it via "all" or "projects"
    const interactive = args.interactive === 'all' || args.interactive === 'projects';
    const dryRun = !!args.dryRun;
    const gitRemote = args.gitRemote;
    const ChangelogRendererClass = (0, resolve_changelog_renderer_1.resolveChangelogRenderer)(config.renderer);
    // Maximum of one remote release client per release group
    const remoteReleaseClient = await (0, remote_release_client_1.createRemoteReleaseClient)(config.createRelease, gitRemote);
    applyRemoteReleaseProviderName(remoteReleaseClient.remoteReleaseProviderName);
    const projectChangelogs = {};
    for (const project of projects) {
        let interpolatedTreePath = config.file || '';
        if (interpolatedTreePath) {
            interpolatedTreePath = (0, utils_1.interpolate)(interpolatedTreePath, {
                projectName: project.name,
                projectRoot: project.data.root,
                workspaceRoot: '', // within the tree, workspaceRoot is the root
            });
        }
        /**
         * newVersion will be null in the case that no changes were detected (e.g. in conventional commits mode),
         * no changelog entry is relevant in that case.
         */
        if (!projectsVersionData[project.name] ||
            (projectsVersionData[project.name].newVersion === null &&
                !projectsVersionData[project.name].dockerVersion)) {
            continue;
        }
        const preferDockerVersion = (0, shared_1.shouldPreferDockerVersionForReleaseGroup)(releaseGroup);
        const releaseVersion = new shared_1.ReleaseVersion({
            version: (preferDockerVersion === true || preferDockerVersion === 'both') &&
                projectsVersionData[project.name].dockerVersion
                ? projectsVersionData[project.name].dockerVersion
                : projectsVersionData[project.name].newVersion,
            releaseTagPattern: releaseGroup.releaseTag.pattern,
            projectName: project.name,
            releaseGroupName: releaseGroup.name,
        });
        if (interpolatedTreePath) {
            const prefix = dryRun ? 'Previewing' : 'Generating';
            output_1.output.log({
                title: `${prefix} an entry in ${interpolatedTreePath} for ${pc.white(releaseVersion.gitTag)}`,
            });
        }
        const changelogRenderer = new ChangelogRendererClass({
            changes,
            changelogEntryVersion: releaseVersion.rawVersion,
            project: project.name,
            entryWhenNoChanges: typeof config.entryWhenNoChanges === 'string'
                ? (0, utils_1.interpolate)(config.entryWhenNoChanges, {
                    projectName: project.name,
                    projectRoot: project.data.root,
                    workspaceRoot: '', // within the tree, workspaceRoot is the root
                })
                : false,
            changelogRenderOptions: config.renderOptions,
            isVersionPlans: !!releaseGroup.versionPlans,
            conventionalCommitsConfig: nxReleaseConfig.conventionalCommits,
            dependencyBumps: projectToAdditionalDependencyBumps.get(project.name),
            remoteReleaseClient,
        });
        let contents = await changelogRenderer.render();
        /**
         * If interactive mode, make the changelog contents available for the user to modify in their editor of choice,
         * in a similar style to git interactive rebases/merges.
         */
        if (interactive) {
            const tmpDir = (0, tmp_1.dirSync)().name;
            const changelogPath = (0, path_1.joinPathFragments)(tmpDir, 
            // Include the tree path in the name so that it is easier to identify which changelog file is being edited
            `PREVIEW__${interpolatedTreePath.replace(/\//g, '_')}`);
            (0, node_fs_1.writeFileSync)(changelogPath, contents);
            await (0, launch_editor_1.launchEditor)(changelogPath);
            contents = (0, node_fs_1.readFileSync)(changelogPath, 'utf-8');
        }
        if (interpolatedTreePath) {
            let changelogContents = tree.exists(interpolatedTreePath)
                ? tree.read(interpolatedTreePath).toString()
                : '';
            if (changelogContents) {
                // NOTE: right now existing releases are always expected to be in markdown format, but in the future we could potentially support others via a custom parser option
                const changelogReleases = (0, markdown_1.parseChangelogMarkdown)(changelogContents).releases;
                const existingVersionToUpdate = changelogReleases.find((r) => r.version === releaseVersion.rawVersion);
                if (existingVersionToUpdate) {
                    changelogContents = changelogContents.replace(`## ${releaseVersion.rawVersion}\n\n\n${existingVersionToUpdate.body}`, contents);
                }
                else {
                    // No existing version, simply prepend the new release to the top of the file
                    changelogContents = `${contents}\n\n${changelogContents}`;
                }
            }
            else {
                // No existing changelog contents, simply create a new one using the generated contents
                changelogContents = contents;
            }
            tree.write(interpolatedTreePath, changelogContents);
            (0, print_changes_1.printAndFlushChanges)(tree, !!dryRun, 3, false, shared_1.noDiffInChangelogMessage, 
            // Only print the change for the current changelog file at this point
            (f) => f.path === interpolatedTreePath);
        }
        const postGitTask = args.createRelease !== false && config.createRelease
            ? remoteReleaseClient.createPostGitTask(releaseVersion, contents, dryRun)
            : null;
        projectChangelogs[project.name] = {
            releaseVersion,
            contents,
            postGitTask,
        };
    }
    return projectChangelogs;
}
function checkChangelogFilesEnabled(nxReleaseConfig) {
    if (nxReleaseConfig.changelog.workspaceChangelog &&
        nxReleaseConfig.changelog.workspaceChangelog.file) {
        return true;
    }
    for (const releaseGroup of Object.values(nxReleaseConfig.groups)) {
        if (releaseGroup.changelog && releaseGroup.changelog.file) {
            return true;
        }
    }
    return false;
}
async function getCommits(fromSHA, toSHA) {
    const rawCommits = await (0, git_1.getGitDiff)(fromSHA, toSHA);
    // Parse as conventional commits
    return (0, git_1.parseCommits)(rawCommits);
}
async function filterProjectCommits({ fromSHA, toSHA, projectPath, }) {
    const allCommits = await getCommits(fromSHA, toSHA);
    return allCommits.filter((c) => c.affectedFiles.find((f) => f.startsWith(projectPath)));
}
async function promptForRemoteRelease() {
    try {
        const result = await (0, enquirer_1.prompt)([
            {
                name: 'confirmation',
                message: `Do you want to create a ${remoteReleaseProviderName ?? 'remote'} release anyway?`,
                type: 'confirm',
            },
        ]);
        return result.confirmation;
    }
    catch {
        // Ensure the cursor is always restored
        process.stdout.write('\u001b[?25h');
        // Handle the case where the user exits the prompt with ctrl+c
        return false;
    }
}
async function resolveWorkspaceChangelogChanges({ releaseGraph, nxReleaseConfig, args, workspacePreid, projectsPreid, useAutomaticFromRef, toSHA, fromSHA, }) {
    // NOTE: If there are multiple release groups, we'll just skip the workspace changelog anyway.
    const versionPlansEnabledForWorkspaceChangelog = releaseGraph.releaseGroups[0]?.resolvedVersionPlans;
    // Derive changes from version plan files
    if (versionPlansEnabledForWorkspaceChangelog) {
        return resolveWorkspaceChangelogFromVersionPlans(releaseGraph);
    }
    // Derive changes from commits
    return resolveWorkspaceChangelogFromCommits({
        nxReleaseConfig,
        args,
        workspacePreid,
        projectsPreid,
        useAutomaticFromRef,
        toSHA,
        fromSHA,
    });
}
function resolveWorkspaceChangelogFromVersionPlans(releaseGraph) {
    const firstReleaseGroup = releaseGraph.releaseGroups[0];
    // We only produce a workspace changelog in the case of a single, fixed relationship release group
    if (releaseGraph.releaseGroups.length !== 1 ||
        firstReleaseGroup?.projectsRelationship !== 'fixed') {
        return [];
    }
    const versionPlans = firstReleaseGroup.resolvedVersionPlans;
    return (0, version_plan_utils_1.createChangesFromGroupVersionPlans)(versionPlans);
}
async function resolveWorkspaceChangelogFromCommits({ nxReleaseConfig, args, workspacePreid, projectsPreid, useAutomaticFromRef, toSHA, fromSHA, }) {
    // Use the cached fromSHA if available, otherwise throw an error
    if (!fromSHA) {
        throw new Error(`Unable to determine the previous git tag. If this is the first release of your workspace, use the --first-release option or set the "release.changelog.automaticFromRef" config property in nx.json to generate a changelog from the first commit. Otherwise, be sure to configure the "release.releaseTag.pattern" property in nx.json to match the structure of your repository's git tags.`);
    }
    const workspaceChangelogFromSHA = fromSHA;
    const commits = await getCommits(workspaceChangelogFromSHA, toSHA);
    // For workspace changelog, all commits affect all projects
    return (0, commit_utils_1.filterHiddenChanges)(commits.map((c) => (0, commit_utils_1.mapCommitToChange)(c, '*')), nxReleaseConfig.conventionalCommits);
}
function extractPreid(version) {
    if (!(0, shared_1.isPrerelease)(version)) {
        return undefined;
    }
    const preid = (0, semver_1.prerelease)(version)?.[0];
    if (typeof preid === 'string') {
        if (preid.trim() === '') {
            return undefined;
        }
        return preid;
    }
    if (typeof preid === 'number') {
        return preid.toString();
    }
    return undefined;
}
