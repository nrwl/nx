"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releaseVersionCLIHandler = void 0;
exports.createAPI = createAPI;
const tslib_1 = require("tslib");
const pc = tslib_1.__importStar(require("picocolors"));
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const nx_json_1 = require("../../config/nx-json");
const run_commands_impl_1 = require("../../executors/run-commands/run-commands.impl");
const format_changed_files_with_prettier_if_available_1 = require("../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const tree_1 = require("../../generators/tree");
const file_map_utils_1 = require("../../project-graph/file-map-utils");
const project_graph_1 = require("../../project-graph/project-graph");
const handle_errors_1 = require("../../utils/handle-errors");
const output_1 = require("../../utils/output");
const path_1 = require("../../utils/path");
const workspace_root_1 = require("../../utils/workspace-root");
const config_1 = require("./config/config");
const deep_merge_json_1 = require("./config/deep-merge-json");
const version_plans_1 = require("./config/version-plans");
const git_1 = require("./utils/git");
const print_changes_1 = require("./utils/print-changes");
const print_config_1 = require("./utils/print-config");
const release_graph_1 = require("./utils/release-graph");
const resolve_nx_json_error_message_1 = require("./utils/resolve-nx-json-error-message");
const shared_1 = require("./utils/shared");
const version_plan_utils_1 = require("./utils/version-plan-utils");
const release_group_processor_1 = require("./version/release-group-processor");
const releaseVersionCLIHandler = (args) => (0, handle_errors_1.handleErrors)(args.verbose, () => createAPI({}, false)(args));
exports.releaseVersionCLIHandler = releaseVersionCLIHandler;
function createAPI(overrideReleaseConfig, ignoreNxJsonConfig) {
    /**
     * NOTE: This function is also exported for programmatic usage and forms part of the public API
     * of Nx. We intentionally do not wrap the implementation with handleErrors because users need
     * to have control over their own error handling when using the API.
     */
    return async function releaseVersion(args) {
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
                title: `The "release.git" property in nx.json may not be used with the "nx release version" subcommand or programmatic API. Instead, configure git options for subcommands directly with "release.version.git" and "release.changelog.git".`,
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
                preid: args.preid,
                versionActionsOptionsOverrides: args.versionActionsOptionsOverrides,
            }));
        // Display filter log if filters were applied
        if (releaseGraph.filterLog &&
            process.env.NX_RELEASE_INTERNAL_SUPPRESS_FILTER_LOG !== 'true') {
            output_1.output.note(releaseGraph.filterLog);
        }
        if (!args.specifier) {
            const rawVersionPlans = await (0, version_plans_1.readRawVersionPlans)();
            await (0, version_plans_1.setResolvedVersionPlansOnGroups)(rawVersionPlans, releaseGraph.releaseGroups, Object.keys(projectGraph.nodes), args.verbose);
            // Validate version plans against the filter after resolution
            const versionPlanValidationError = (0, version_plan_utils_1.validateResolvedVersionPlansAgainstFilter)(releaseGraph.releaseGroups, releaseGraph.releaseGroupToFilteredProjects);
            if (versionPlanValidationError) {
                output_1.output.error(versionPlanValidationError);
                process.exit(1);
            }
        }
        else {
            if (args.verbose &&
                releaseGraph.releaseGroups.some((g) => !!g.versionPlans)) {
                console.log(`Skipping version plan discovery as a specifier was provided`);
            }
        }
        if (args.deleteVersionPlans === undefined) {
            // default to not delete version plans after versioning as they may be needed for changelog generation
            args.deleteVersionPlans = false;
        }
        /**
         * Run any configured top level pre-version command
         */
        runPreVersionCommand(nxReleaseConfig.version?.preVersionCommand, {
            dryRun: args.dryRun,
            verbose: args.verbose,
        });
        /**
         * Run any configured pre-version command for the selected release groups
         * in topological order
         */
        for (const groupName of releaseGraph.sortedReleaseGroups) {
            const releaseGroup = releaseGraph.releaseGroups.find((g) => g.name === groupName);
            if (!releaseGroup) {
                // Release group was filtered out, skip
                continue;
            }
            runPreVersionCommand(releaseGroup.version?.groupPreVersionCommand, {
                dryRun: args.dryRun,
                verbose: args.verbose,
            }, releaseGroup);
        }
        /**
         * Validate the resolved data for the release graph, e.g. that manifest files exist for all projects that will be processed.
         * This happens after preVersionCommands run, as those commands may create manifest files needed for versioning.
         */
        await releaseGraph.validate(tree);
        const commitMessage = args.gitCommitMessage || nxReleaseConfig.version.git.commitMessage;
        /**
         * additionalChangedFiles are files which need to be updated as a side-effect of versioning (such as package manager lock files),
         * and need to get staged and committed as part of the existing commit, if applicable.
         */
        const additionalChangedFiles = new Set();
        const additionalDeletedFiles = new Set();
        const processor = new release_group_processor_1.ReleaseGroupProcessor(tree, projectGraph, nxReleaseConfig, releaseGraph, {
            dryRun: args.dryRun,
            verbose: args.verbose,
            firstRelease: args.firstRelease,
            preid: args.preid ?? '',
            userGivenSpecifier: args.specifier,
            filters: {
                projects: args.projects,
                groups: args.groups,
            },
            versionActionsOptionsOverrides: args.versionActionsOptionsOverrides,
        });
        try {
            await processor.processGroups();
            // Delete processed version plan files if applicable
            if (args.deleteVersionPlans) {
                processor.deleteProcessedVersionPlanFiles();
            }
        }
        catch (err) {
            // Flush any pending project logs before printing the error to make troubleshooting easier
            processor.flushAllProjectLoggers();
            // Bubble up the error so that the CLI can print the error and exit, or the programmatic API can handle it
            throw err;
        }
        /**
         * Ensure that formatting is applied so that version bump diffs are as minimal as possible
         * within the context of the user's workspace.
         */
        await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree, { silent: true });
        printAndFlushChanges(tree, !!args.dryRun);
        const { changedFiles: changed, deletedFiles: deleted } = await processor.afterAllProjectsVersioned({
            ...nxReleaseConfig.version
                .versionActionsOptions,
            ...(args.versionActionsOptionsOverrides ?? {}),
        });
        changed.forEach((f) => additionalChangedFiles.add(f));
        deleted.forEach((f) => additionalDeletedFiles.add(f));
        // After all version actions have run, process docker projects as a layer above
        if (nxReleaseConfig.docker?.preVersionCommand) {
            /**
             * Run any configured top level docker pre-version command
             */
            runPreVersionCommand(nxReleaseConfig.docker.preVersionCommand, {
                dryRun: args.dryRun,
                verbose: args.verbose,
            }, undefined, true);
        }
        /**
         * Run any configured docker pre-version command for the selected release groups
         * in topological order (dependencies before dependents)
         */
        for (const groupName of releaseGraph.sortedReleaseGroups) {
            const releaseGroup = releaseGraph.releaseGroups.find((g) => g.name === groupName);
            if (!releaseGroup) {
                // Release group was filtered out, skip
                continue;
            }
            if (releaseGroup.docker?.groupPreVersionCommand) {
                runPreVersionCommand(releaseGroup.docker.groupPreVersionCommand, {
                    dryRun: args.dryRun,
                    verbose: args.verbose,
                }, releaseGroup, true);
            }
        }
        // TODO(colum): Remove when Docker support is no longer experimental
        if (nxReleaseConfig.docker ||
            releaseGraph.releaseGroups.some((rg) => rg.docker)) {
            output_1.output.warn({
                title: 'Warning',
                bodyLines: [
                    `Docker support is experimental. Breaking changes may occur and not adhere to semver versioning.`,
                ],
            });
        }
        await processor.processDockerProjects(args.dockerVersionScheme, args.dockerVersion);
        const versionData = processor.getVersionData();
        // Resolve any git tags as early as possible so that we can hard error in case of any duplicates before reaching the actual git command
        const gitTagValues = (args.gitTag ?? nxReleaseConfig.version.git.tag)
            ? (0, shared_1.createGitTagValues)(releaseGraph.releaseGroups, releaseGraph.releaseGroupToFilteredProjects, versionData)
            : [];
        (0, shared_1.handleDuplicateGitTags)(gitTagValues);
        // Only applicable when there is a single release group with a fixed relationship
        let workspaceVersion = undefined;
        if (releaseGraph.releaseGroups.length === 1) {
            const releaseGroup = releaseGraph.releaseGroups[0];
            if (releaseGroup.projectsRelationship === 'fixed') {
                const releaseGroupProjectNames = Array.from(releaseGraph.releaseGroupToFilteredProjects.get(releaseGroup));
                workspaceVersion = versionData[releaseGroupProjectNames[0]].newVersion; // all projects have the same version so we can just grab the first
            }
        }
        const changedFiles = [
            ...tree.listChanges().map((f) => f.path),
            ...additionalChangedFiles,
        ];
        const deletedFiles = Array.from(additionalDeletedFiles);
        // No further actions are necessary in this scenario (e.g. if conventional commits detected no changes)
        if (!changedFiles.length && !deletedFiles.length) {
            return {
                workspaceVersion,
                projectsVersionData: versionData,
                releaseGraph,
            };
        }
        if (args.gitCommit ?? nxReleaseConfig.version.git.commit) {
            await (0, shared_1.commitChanges)({
                changedFiles,
                deletedFiles,
                isDryRun: !!args.dryRun,
                isVerbose: !!args.verbose,
                gitCommitMessages: (0, shared_1.createCommitMessageValues)(releaseGraph.releaseGroups, releaseGraph.releaseGroupToFilteredProjects, versionData, commitMessage),
                gitCommitArgs: args.gitCommitArgs || nxReleaseConfig.version.git.commitArgs,
            });
        }
        else if (args.stageChanges ?? nxReleaseConfig.version.git.stageChanges) {
            output_1.output.logSingleLine(`Staging changed files with git`);
            await (0, git_1.gitAdd)({
                changedFiles,
                deletedFiles,
                dryRun: args.dryRun,
                verbose: args.verbose,
            });
        }
        if (args.gitTag ?? nxReleaseConfig.version.git.tag) {
            output_1.output.logSingleLine(`Tagging commit with git`);
            for (const tag of gitTagValues) {
                await (0, git_1.gitTag)({
                    tag,
                    message: args.gitTagMessage || nxReleaseConfig.version.git.tagMessage,
                    additionalArgs: args.gitTagArgs || nxReleaseConfig.version.git.tagArgs,
                    dryRun: args.dryRun,
                    verbose: args.verbose,
                });
            }
        }
        if (args.gitPush ?? nxReleaseConfig.version.git.push) {
            output_1.output.logSingleLine(`Pushing to git remote "${args.gitRemote ?? 'origin'}"`);
            await (0, git_1.gitPush)({
                gitRemote: args.gitRemote,
                dryRun: args.dryRun,
                verbose: args.verbose,
                additionalArgs: args.gitPushArgs || nxReleaseConfig.version.git.pushArgs,
            });
        }
        return {
            workspaceVersion,
            projectsVersionData: versionData,
            releaseGraph,
        };
    };
}
function printAndFlushChanges(tree, isDryRun) {
    const changes = tree.listChanges();
    console.log('');
    if (changes.length > 0) {
        // Print the changes
        changes.forEach((f) => {
            if (f.type === 'CREATE') {
                console.error(`${pc.green('CREATE')} ${f.path}${isDryRun ? (0, output_1.orange)(' [dry-run]') : ''}`);
                (0, print_changes_1.printDiff)('', f.content?.toString() || '');
            }
            else if (f.type === 'UPDATE') {
                console.error(`${pc.white('UPDATE')} ${f.path}${isDryRun ? (0, output_1.orange)(' [dry-run]') : ''}`);
                const currentContentsOnDisk = (0, node_fs_1.readFileSync)((0, path_1.joinPathFragments)(tree.root, f.path)).toString();
                (0, print_changes_1.printDiff)(currentContentsOnDisk, f.content?.toString() || '');
            }
            else if (f.type === 'DELETE' && !f.path.includes('.nx')) {
                throw new Error('Unexpected DELETE change, please report this as an issue');
            }
        });
    }
    else {
        let text = isDryRun ? ' would be ' : ' ';
        output_1.output.warn({
            title: `No files${text}changed as a result of running versioning`,
        });
    }
    if (!isDryRun) {
        (0, tree_1.flushChanges)(workspace_root_1.workspaceRoot, changes);
    }
}
function runPreVersionCommand(preVersionCommand, { dryRun, verbose }, releaseGroup, dockerPreVersionCommand = false) {
    if (!preVersionCommand) {
        return;
    }
    output_1.output.logSingleLine(releaseGroup
        ? `Executing${dockerPreVersionCommand ? ` docker` : ` release group`} pre-version command for "${releaseGroup.name}"`
        : `Executing${dockerPreVersionCommand ? ` docker` : ``} pre-version command`);
    if (verbose) {
        console.log(`Executing the following pre-version command:`);
        console.log(preVersionCommand);
    }
    let env = {
        ...process.env,
    };
    if (dryRun) {
        env.NX_DRY_RUN = 'true';
    }
    const stdio = verbose ? 'inherit' : 'pipe';
    try {
        (0, node_child_process_1.execSync)(preVersionCommand, {
            encoding: 'utf-8',
            maxBuffer: run_commands_impl_1.LARGE_BUFFER,
            stdio,
            env,
            windowsHide: true,
        });
    }
    catch (e) {
        const title = verbose
            ? `The pre-version command failed. See the full output above.`
            : `The pre-version command failed. Retry with --verbose to see the full output of the pre-version command.`;
        output_1.output.error({
            title,
            bodyLines: [preVersionCommand, e],
        });
        process.exit(1);
    }
}
