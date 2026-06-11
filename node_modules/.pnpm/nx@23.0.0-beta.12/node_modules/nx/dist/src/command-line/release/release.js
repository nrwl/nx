"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releaseCLIHandler = void 0;
exports.createAPI = createAPI;
const enquirer_1 = require("enquirer");
const node_fs_1 = require("node:fs");
const nx_json_1 = require("../../config/nx-json");
const file_map_utils_1 = require("../../project-graph/file-map-utils");
const project_graph_1 = require("../../project-graph/project-graph");
const handle_errors_1 = require("../../utils/handle-errors");
const output_1 = require("../../utils/output");
const changelog_1 = require("./changelog");
const config_1 = require("./config/config");
const deep_merge_json_1 = require("./config/deep-merge-json");
const version_plans_1 = require("./config/version-plans");
const publish_1 = require("./publish");
const git_1 = require("./utils/git");
const print_config_1 = require("./utils/print-config");
const remote_release_client_1 = require("./utils/remote-release-clients/remote-release-client");
const resolve_nx_json_error_message_1 = require("./utils/resolve-nx-json-error-message");
const shared_1 = require("./utils/shared");
const version_plan_utils_1 = require("./utils/version-plan-utils");
const version_1 = require("./version");
const releaseCLIHandler = (args) => (0, handle_errors_1.handleErrors)(args.verbose, () => createAPI({}, false)(args));
exports.releaseCLIHandler = releaseCLIHandler;
function createAPI(overrideReleaseConfig, ignoreNxJsonConfig) {
    const releaseVersion = (0, version_1.createAPI)(overrideReleaseConfig, ignoreNxJsonConfig);
    const releaseChangelog = (0, changelog_1.createAPI)(overrideReleaseConfig, ignoreNxJsonConfig);
    const releasePublish = (0, publish_1.createAPI)(overrideReleaseConfig, ignoreNxJsonConfig);
    return async function release(args) {
        const projectGraph = await (0, project_graph_1.createProjectGraphAsync)({ exitOnError: true });
        const overriddenConfig = overrideReleaseConfig ?? {};
        const userProvidedReleaseConfig = ignoreNxJsonConfig
            ? overriddenConfig
            : (0, deep_merge_json_1.deepMergeJson)((0, nx_json_1.readNxJson)().release ?? {}, overriddenConfig);
        const hasVersionGitConfig = Object.keys(userProvidedReleaseConfig.version?.git ?? {}).length > 0;
        const hasChangelogGitConfig = Object.keys(userProvidedReleaseConfig.changelog?.git ?? {}).length > 0;
        if (hasVersionGitConfig || hasChangelogGitConfig) {
            const jsonConfigErrorPath = hasVersionGitConfig
                ? ['release', 'version', 'git']
                : ['release', 'changelog', 'git'];
            const nxJsonMessage = await (0, resolve_nx_json_error_message_1.resolveNxJsonConfigErrorMessage)(jsonConfigErrorPath);
            output_1.output.error({
                title: `The "release" top level command cannot be used with granular git configuration. Instead, configure git options in the "release.git" property in nx.json, or use the version, changelog, and publish subcommands or programmatic API directly.`,
                bodyLines: [nxJsonMessage],
            });
            process.exit(1);
        }
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
        const rawVersionPlans = await (0, version_plans_1.readRawVersionPlans)();
        if (args.specifier && rawVersionPlans.length > 0) {
            output_1.output.error({
                title: `A specifier option cannot be provided when using version plans.`,
                bodyLines: [
                    `To override this behavior, use the Nx Release programmatic API directly (https://nx.dev/features/manage-releases#using-the-programmatic-api-for-nx-release).`,
                ],
            });
            process.exit(1);
        }
        // These properties must never be undefined as this command should
        // always explicitly override the git operations of the subcommands.
        const shouldCommit = userProvidedReleaseConfig.git?.commit ?? true;
        const shouldStage = (shouldCommit || userProvidedReleaseConfig.git?.stageChanges) ?? false;
        const shouldTag = userProvidedReleaseConfig.git?.tag ?? true;
        const shouldCreateWorkspaceRemoteRelease = shouldCreateRemoteRelease(nxReleaseConfig.changelog.workspaceChangelog);
        const { workspaceVersion, projectsVersionData, releaseGraph, } = await releaseVersion({
            ...args,
            stageChanges: shouldStage,
            gitCommit: false,
            gitTag: false,
            deleteVersionPlans: false,
        });
        // Suppress the filter log for the changelog command as it would have already been printed by the version command
        process.env.NX_RELEASE_INTERNAL_SUPPRESS_FILTER_LOG = 'true';
        const changelogResult = await releaseChangelog({
            ...args,
            // Re-use existing release graph
            releaseGraph,
            versionData: projectsVersionData,
            version: workspaceVersion,
            stageChanges: shouldStage,
            gitCommit: false,
            gitTag: false,
            gitPush: false,
            createRelease: false,
            deleteVersionPlans: false,
        });
        await (0, version_plans_1.setResolvedVersionPlansOnGroups)(rawVersionPlans, releaseGraph.releaseGroups, Object.keys(projectGraph.nodes), args.verbose);
        // Validate version plans against the filter after resolution
        const versionPlanValidationError = (0, version_plan_utils_1.validateResolvedVersionPlansAgainstFilter)(releaseGraph.releaseGroups, releaseGraph.releaseGroupToFilteredProjects);
        if (versionPlanValidationError) {
            output_1.output.error(versionPlanValidationError);
            process.exit(1);
        }
        const planFiles = new Set();
        releaseGraph.releaseGroups.forEach((group) => {
            const filteredProjects = releaseGraph.releaseGroupToFilteredProjects.get(group);
            if (group.resolvedVersionPlans) {
                // Check each version plan individually to see if it should be deleted
                const plansToDelete = [];
                for (const plan of group.resolvedVersionPlans) {
                    // Only delete if ALL projects in the version plan are being filtered/released
                    if ((0, version_plan_utils_1.areAllVersionPlanProjectsFiltered)(plan, group, filteredProjects)) {
                        plansToDelete.push(plan);
                    }
                }
                // Only log and delete if we have plans to delete
                if (plansToDelete.length > 0) {
                    if (group.name === config_1.IMPLICIT_DEFAULT_RELEASE_GROUP) {
                        output_1.output.logSingleLine(`Removing version plan files`);
                    }
                    else {
                        output_1.output.logSingleLine(`Removing version plan files for group ${group.name}`);
                    }
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
            }
        });
        const deletedFiles = Array.from(planFiles);
        if (deletedFiles.length > 0) {
            await (0, git_1.gitAdd)({
                changedFiles: [],
                deletedFiles,
                dryRun: args.dryRun,
                verbose: args.verbose,
            });
        }
        if (shouldCommit) {
            output_1.output.logSingleLine(`Committing changes with git`);
            const commitMessage = nxReleaseConfig.git.commitMessage;
            const commitMessageValues = (0, shared_1.createCommitMessageValues)(releaseGraph.releaseGroups, releaseGraph.releaseGroupToFilteredProjects, projectsVersionData, commitMessage);
            await (0, git_1.gitCommit)({
                messages: commitMessageValues,
                additionalArgs: nxReleaseConfig.git.commitArgs,
                dryRun: args.dryRun,
                verbose: args.verbose,
            });
        }
        if (shouldTag) {
            output_1.output.logSingleLine(`Tagging commit with git`);
            // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
            const gitTagValues = (0, shared_1.createGitTagValues)(releaseGraph.releaseGroups, releaseGraph.releaseGroupToFilteredProjects, projectsVersionData);
            (0, shared_1.handleDuplicateGitTags)(gitTagValues);
            for (const tag of gitTagValues) {
                await (0, git_1.gitTag)({
                    tag,
                    message: nxReleaseConfig.git.tagMessage,
                    additionalArgs: nxReleaseConfig.git.tagArgs,
                    dryRun: args.dryRun,
                    verbose: args.verbose,
                });
            }
        }
        let hasPushedChanges = false;
        // If the workspace or any of the release groups specify that a remote release should be created, we need to push the changes to the remote
        const shouldPush = (shouldCreateWorkspaceRemoteRelease ||
            releaseGraph.releaseGroups.some((group) => shouldCreateRemoteRelease(group.changelog))) ??
            false;
        if (shouldPush) {
            output_1.output.logSingleLine(`Pushing to git remote "origin"`);
            await (0, git_1.gitPush)({
                dryRun: args.dryRun,
                verbose: args.verbose,
                additionalArgs: nxReleaseConfig.git.pushArgs,
            });
            hasPushedChanges = true;
        }
        let latestCommit;
        if (shouldCreateWorkspaceRemoteRelease &&
            changelogResult.workspaceChangelog) {
            const remoteReleaseClient = await (0, remote_release_client_1.createRemoteReleaseClient)(
            // shouldCreateWorkspaceRemoteRelease() ensures that the createRelease property exists and is not false
            nxReleaseConfig.changelog.workspaceChangelog
                .createRelease);
            if (!hasPushedChanges) {
                throw new Error(`It is not possible to create a ${remoteReleaseClient.remoteReleaseProviderName} release for the workspace without pushing the changes to the remote, please ensure that you have not disabled git push in your nx release config`);
            }
            output_1.output.logSingleLine(`Creating ${remoteReleaseClient.remoteReleaseProviderName} Release`);
            latestCommit = await (0, git_1.getCommitHash)('HEAD');
            await remoteReleaseClient.createOrUpdateRelease(changelogResult.workspaceChangelog.releaseVersion, changelogResult.workspaceChangelog.contents, latestCommit, { dryRun: args.dryRun });
        }
        for (const releaseGroupName of releaseGraph.sortedReleaseGroups) {
            const releaseGroup = releaseGraph.releaseGroups.find((g) => g.name === releaseGroupName);
            if (!releaseGroup) {
                continue;
            }
            const shouldCreateProjectRemoteReleases = shouldCreateRemoteRelease(releaseGroup.changelog);
            if (shouldCreateProjectRemoteReleases &&
                changelogResult.projectChangelogs) {
                const remoteReleaseClient = await (0, remote_release_client_1.createRemoteReleaseClient)(
                // shouldCreateProjectRemoteReleases() ensures that the createRelease property exists and is not false
                releaseGroup.changelog
                    .createRelease);
                const projects = args.projects?.length
                    ? // If the user has passed a list of projects, we need to use the filtered list of projects within the release group
                        Array.from(releaseGraph.releaseGroupToFilteredProjects.get(releaseGroup))
                    : // Otherwise, we use the full list of projects within the release group
                        releaseGroup.projects;
                const projectNodes = projects.map((name) => projectGraph.nodes[name]);
                for (const project of projectNodes) {
                    const changelog = changelogResult.projectChangelogs[project.name];
                    if (!changelog) {
                        continue;
                    }
                    if (!hasPushedChanges) {
                        throw new Error(`It is not possible to create a ${remoteReleaseClient.remoteReleaseProviderName} release for the project without pushing the changes to the remote, please ensure that you have not disabled git push in your nx release config`);
                    }
                    output_1.output.logSingleLine(`Creating ${remoteReleaseClient.remoteReleaseProviderName} Release`);
                    if (!latestCommit) {
                        latestCommit = await (0, git_1.getCommitHash)('HEAD');
                    }
                    await remoteReleaseClient.createOrUpdateRelease(changelog.releaseVersion, changelog.contents, latestCommit, { dryRun: args.dryRun });
                }
            }
        }
        let hasNewVersion = false;
        // null means that all projects are versioned together but there were no changes
        if (workspaceVersion !== null) {
            hasNewVersion = Object.values(projectsVersionData).some((version) => 
            /**
             * There is a scenario where applications will not have a newVersion created by VerisonActions,
             * however, there will still be a dockerVersion created from the docker release.
             */
            version.newVersion !== null || version.dockerVersion !== null);
        }
        let shouldPublish = !!args.yes && !args.skipPublish && hasNewVersion;
        const shouldPromptPublishing = !args.yes && !args.skipPublish && !args.dryRun && hasNewVersion;
        if (shouldPromptPublishing) {
            shouldPublish = await promptForPublish();
        }
        if (shouldPublish) {
            const publishResults = await releasePublish({
                ...args,
                versionData: projectsVersionData,
            });
            const allExitOk = Object.values(publishResults).every((result) => result.code === 0);
            if (!allExitOk) {
                // When a publish target fails, we want to fail the nx release CLI
                process.exit(1);
            }
        }
        else {
            output_1.output.logSingleLine('Skipped publishing packages.');
        }
        return {
            workspaceVersion,
            projectsVersionData,
            releaseGraph,
        };
    };
}
async function promptForPublish() {
    try {
        const reply = await (0, enquirer_1.prompt)([
            {
                name: 'confirmation',
                message: 'Do you want to publish these versions?',
                type: 'confirm',
            },
        ]);
        return reply.confirmation;
    }
    catch {
        // Ensure the cursor is always restored before exiting
        process.stdout.write('\u001b[?25h');
        // Handle the case where the user exits the prompt with ctrl+c
        return false;
    }
}
function shouldCreateRemoteRelease(changelogConfig) {
    if (changelogConfig === false) {
        return false;
    }
    return changelogConfig.createRelease !== false;
}
