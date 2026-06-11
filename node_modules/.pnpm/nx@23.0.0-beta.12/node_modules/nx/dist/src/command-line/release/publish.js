"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.releasePublishCLIHandler = void 0;
exports.createAPI = createAPI;
const nx_json_1 = require("../../config/nx-json");
const tree_1 = require("../../generators/tree");
const native_1 = require("../../native");
const file_map_utils_1 = require("../../project-graph/file-map-utils");
const tasks_execution_hooks_1 = require("../../project-graph/plugins/tasks-execution-hooks");
const project_graph_1 = require("../../project-graph/project-graph");
const run_command_1 = require("../../tasks-runner/run-command");
const command_line_utils_1 = require("../../utils/command-line-utils");
const handle_errors_1 = require("../../utils/handle-errors");
const output_1 = require("../../utils/output");
const project_graph_utils_1 = require("../../utils/project-graph-utils");
const workspace_root_1 = require("../../utils/workspace-root");
const graph_1 = require("../graph/graph");
const config_1 = require("./config/config");
const deep_merge_json_1 = require("./config/deep-merge-json");
const print_config_1 = require("./utils/print-config");
const release_graph_1 = require("./utils/release-graph");
const releasePublishCLIHandler = (args) => (0, handle_errors_1.handleErrors)(args.verbose, async () => {
    const publishProjectsResult = await createAPI({}, false)(args);
    // If all projects are published successfully, return 0, otherwise return 1
    return Object.values(publishProjectsResult).every((result) => result.code === 0)
        ? 0
        : 1;
});
exports.releasePublishCLIHandler = releasePublishCLIHandler;
function createAPI(overrideReleaseConfig, ignoreNxJsonConfig) {
    /**
     * NOTE: This function is also exported for programmatic usage and forms part of the public API
     * of Nx. We intentionally do not wrap the implementation with handleErrors because users need
     * to have control over their own error handling when using the API.
     */
    return async function releasePublish(args) {
        /**
         * When used via the CLI, the args object will contain a __overrides_unparsed__ property that is
         * important for invoking the relevant executor behind the scenes.
         *
         * We intentionally do not include that in the function signature, however, so as not to cause
         * confusing errors for programmatic consumers of this function.
         */
        const _args = args;
        const projectGraph = await (0, project_graph_1.createProjectGraphAsync)({ exitOnError: true });
        const nxJson = (0, nx_json_1.readNxJson)();
        const overriddenConfig = overrideReleaseConfig ?? {};
        const userProvidedReleaseConfig = ignoreNxJsonConfig
            ? overriddenConfig
            : (0, deep_merge_json_1.deepMergeJson)(nxJson.release ?? {}, overriddenConfig);
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
        // Use pre-built release graph if provided, otherwise create a new one
        const releaseGraph = args.releaseGraph ||
            (await (0, release_graph_1.createReleaseGraph)({
                // Only build the tree if no existing graph, it's only needed for this
                tree: new tree_1.FsTree(workspace_root_1.workspaceRoot, args.verbose),
                projectGraph,
                nxReleaseConfig,
                filters: {
                    projects: _args.projects,
                    groups: _args.groups,
                },
                firstRelease: args.firstRelease,
                verbose: args.verbose,
                // Publish doesn't need to resolve current versions during graph construction
                skipVersionResolution: true,
            }));
        // Display filter log if filters were applied
        if (releaseGraph.filterLog &&
            process.env.NX_RELEASE_INTERNAL_SUPPRESS_FILTER_LOG !== 'true') {
            output_1.output.note(releaseGraph.filterLog);
        }
        /**
         * If the user is filtering to a subset of projects or groups, we should not run the publish task
         * for dependencies, because that could cause projects outset of the filtered set to be published.
         */
        const shouldExcludeTaskDependencies = _args.projects?.length > 0 ||
            _args.groups?.length > 0 ||
            args.excludeTaskDependencies;
        let overallPublishProjectsResult = {};
        if (args.projects?.length) {
            /**
             * Run publishing for all remaining release groups and filtered projects within them
             * in topological order
             */
            for (const releaseGroupName of releaseGraph.sortedReleaseGroups) {
                const releaseGroup = releaseGraph.releaseGroups.find((g) => g.name === releaseGroupName);
                if (!releaseGroup) {
                    // Release group was filtered out, skip
                    continue;
                }
                const publishProjectsResult = await runPublishOnProjects(_args, projectGraph, nxJson, Array.from(releaseGraph.releaseGroupToFilteredProjects.get(releaseGroup)), {
                    excludeTaskDependencies: shouldExcludeTaskDependencies,
                    loadDotEnvFiles: process.env.NX_LOAD_DOT_ENV_FILES !== 'false',
                });
                overallPublishProjectsResult = {
                    ...overallPublishProjectsResult,
                    ...publishProjectsResult,
                };
            }
            return overallPublishProjectsResult;
        }
        /**
         * Run publishing for all remaining release groups
         */
        for (const releaseGroupName of releaseGraph.sortedReleaseGroups) {
            const releaseGroup = releaseGraph.releaseGroups.find((g) => g.name === releaseGroupName);
            if (!releaseGroup) {
                // Release group was filtered out, skip
                continue;
            }
            const publishProjectsResult = await runPublishOnProjects(_args, projectGraph, nxJson, releaseGroup.projects, {
                excludeTaskDependencies: shouldExcludeTaskDependencies,
                loadDotEnvFiles: process.env.NX_LOAD_DOT_ENV_FILES !== 'false',
            });
            overallPublishProjectsResult = {
                ...overallPublishProjectsResult,
                ...publishProjectsResult,
            };
        }
        return overallPublishProjectsResult;
    };
}
async function runPublishOnProjects(args, projectGraph, nxJson, projectNames, extraOptions) {
    const projectsToRun = projectNames.map((projectName) => projectGraph.nodes[projectName]);
    const overrides = (0, command_line_utils_1.createOverrides)(args.__overrides_unparsed__);
    if (args.registry) {
        overrides.registry = args.registry;
    }
    if (args.tag) {
        overrides.tag = args.tag;
    }
    if (args.otp) {
        overrides.otp = args.otp;
    }
    if (args.access) {
        overrides.access = args.access;
    }
    if (args.dryRun) {
        overrides.dryRun = args.dryRun;
        /**
         * Ensure the env var is set too, so that any and all publish executors triggered
         * indirectly via dependsOn can also pick up on the fact that this is a dry run.
         */
        process.env.NX_DRY_RUN = 'true';
    }
    if (args.firstRelease) {
        overrides.firstRelease = args.firstRelease;
    }
    /**
     * If using the `nx release` command, or possibly via the programmatic API, versionData will be passed through from the version subcommand.
     * Provide it automatically to the publish executor options with a clear namespace to avoid userland conflicts.
     * It will be filtered out of the final terminal output lifecycle to avoid cluttering the terminal.
     */
    if (args.versionData) {
        overrides.nxReleaseVersionData = args.versionData;
    }
    const requiredTargetName = 'nx-release-publish';
    if (args.graph) {
        const file = (0, command_line_utils_1.readGraphFileFromGraphArg)(args);
        const projectNamesWithTarget = projectsToRun
            .map((t) => t.name)
            .filter((projectName) => (0, project_graph_utils_1.projectHasTarget)(projectGraph.nodes[projectName], requiredTargetName));
        await (0, graph_1.generateGraph)({
            watch: true,
            all: false,
            open: true,
            view: 'tasks',
            targets: [requiredTargetName],
            projects: projectNamesWithTarget,
            file,
        }, projectNamesWithTarget);
        return {};
    }
    const projectsWithTarget = projectsToRun.filter((project) => (0, project_graph_utils_1.projectHasTarget)(project, requiredTargetName));
    if (projectsWithTarget.length === 0) {
        throw new Error(`Based on your config, the following projects were matched for publishing but do not have the "${requiredTargetName}" target specified:\n${[
            ...projectsToRun.map((p) => `- ${p.name}`),
            '',
            `This is usually caused by either`,
            `- not having an appropriate plugin, such as "@nx/js" installed, which will add the appropriate "${requiredTargetName}" target for you automatically`,
            `- having "private": true set in your package.json, which prevents the target from being created`,
        ].join('\n')}\n`);
    }
    const id = (0, native_1.hashArray)([...process.argv, Date.now().toString()]);
    await (0, tasks_execution_hooks_1.runPreTasksExecution)({
        id,
        workspaceRoot: workspace_root_1.workspaceRoot,
        nxJsonConfiguration: nxJson,
        argv: process.argv,
    });
    const startTime = Date.now();
    /**
     * Run the relevant nx-release-publish executor on each of the selected projects.
     * NOTE: Force TUI to be disabled for now.
     */
    process.env.NX_TUI = 'false';
    const { taskResults } = await (0, run_command_1.runCommandForTasks)(projectsWithTarget, projectGraph, { nxJson }, {
        targets: [requiredTargetName],
        outputStyle: 'static',
        ...args,
        // It is possible for workspaces to have circular dependencies between packages and still release them to a registry
        nxIgnoreCycles: true,
    }, overrides, null, {}, extraOptions);
    const endTime = Date.now();
    const publishProjectsResult = {};
    for (const taskData of Object.values(taskResults)) {
        publishProjectsResult[taskData.task.target.project] = {
            code: taskData.code,
        };
    }
    // Check for EOTP errors and provide a helpful re-run command
    const eotpFailedProjects = getEOTPFailedProjects(taskResults);
    if (eotpFailedProjects.length > 0) {
        output_1.output.warn({
            title: 'One or more packages failed to publish because a valid OTP was not provided or has expired.',
            bodyLines: [
                'Affected projects:',
                ...eotpFailedProjects.map((p) => `  - ${p}`),
                '',
                'You can provide a new OTP and re-run the publish step in isolation:',
                '',
                `  ${buildRerunCommand(args)}`,
            ],
        });
    }
    await (0, tasks_execution_hooks_1.runPostTasksExecution)({
        id,
        taskResults,
        workspaceRoot: workspace_root_1.workspaceRoot,
        nxJsonConfiguration: nxJson,
        argv: process.argv,
        startTime,
        endTime,
    });
    return publishProjectsResult;
}
/**
 * Return project names for failed tasks that contain EOTP error indicators in their terminal output.
 * npm returns error code "EOTP" in JSON output.
 * pnpm returns "EOTP" in error messages.
 * Both will appear in the captured terminal output.
 */
function getEOTPFailedProjects(taskResults) {
    return Object.values(taskResults)
        .filter((result) => result.code !== 0 &&
        result.terminalOutput &&
        (result.terminalOutput.includes('EOTP') ||
            result.terminalOutput.includes('one-time pass') ||
            result.terminalOutput.includes('one-time password')))
        .map((result) => result.task.target.project);
}
function buildRerunCommand(args) {
    const parts = ['nx release publish'];
    if (args.registry) {
        parts.push(`--registry=${args.registry}`);
    }
    if (args.tag) {
        parts.push(`--tag=${args.tag}`);
    }
    if (args.access) {
        parts.push(`--access=${args.access}`);
    }
    if (args.projects?.length) {
        parts.push(`--projects=${args.projects.join(',')}`);
    }
    if (args.groups?.length) {
        parts.push(`--groups=${args.groups.join(',')}`);
    }
    if (args.firstRelease) {
        parts.push('--first-release');
    }
    if (args.verbose) {
        parts.push('--verbose');
    }
    parts.push('--otp=REPLACE_WITH_NEW_OTP');
    return parts.join(' ');
}
