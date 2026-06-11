"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCommand = runCommand;
exports.runCommandForTasks = runCommandForTasks;
exports.setEnvVarsBasedOnArgs = setEnvVarsBasedOnArgs;
exports.invokeTasksRunner = invokeTasksRunner;
exports.constructLifeCycles = constructLifeCycles;
exports.getRunner = getRunner;
exports.getRunnerOptions = getRunnerOptions;
const tslib_1 = require("tslib");
const enquirer_1 = require("enquirer");
const node_path_1 = require("node:path");
const node_util_1 = require("node:util");
const nx_json_1 = require("../config/nx-json");
const client_1 = require("../daemon/client/client");
const spinner_1 = require("../utils/spinner");
const create_task_hasher_1 = require("../hasher/create-task-hasher");
const hash_task_1 = require("../hasher/hash-task");
const native_1 = require("../native");
const tasks_execution_hooks_1 = require("../project-graph/plugins/tasks-execution-hooks");
const project_graph_1 = require("../project-graph/project-graph");
const handle_errors_1 = require("../utils/handle-errors");
const is_ci_1 = require("../utils/is-ci");
const nx_cloud_utils_1 = require("../utils/nx-cloud-utils");
const logger_1 = require("../utils/logger");
const nx_key_1 = require("../utils/nx-key");
const output_1 = require("../utils/output");
const sync_generators_1 = require("../utils/sync-generators");
const workspace_root_1 = require("../utils/workspace-root");
const create_task_graph_1 = require("./create-task-graph");
const is_tui_enabled_1 = require("./is-tui-enabled");
const life_cycle_1 = require("./life-cycle");
const dynamic_run_many_terminal_output_life_cycle_1 = require("./life-cycles/dynamic-run-many-terminal-output-life-cycle");
const dynamic_run_one_terminal_output_life_cycle_1 = require("./life-cycles/dynamic-run-one-terminal-output-life-cycle");
const static_run_many_terminal_output_life_cycle_1 = require("./life-cycles/static-run-many-terminal-output-life-cycle");
const static_run_one_terminal_output_life_cycle_1 = require("./life-cycles/static-run-one-terminal-output-life-cycle");
const store_run_information_life_cycle_1 = require("./life-cycles/store-run-information-life-cycle");
const task_history_life_cycle_1 = require("./life-cycles/task-history-life-cycle");
const task_profiling_life_cycle_1 = require("./life-cycles/task-profiling-life-cycle");
const task_results_life_cycle_1 = require("./life-cycles/task-results-life-cycle");
const task_telemetry_life_cycle_1 = require("./life-cycles/task-telemetry-life-cycle");
const task_timings_life_cycle_1 = require("./life-cycles/task-timings-life-cycle");
const tui_summary_life_cycle_1 = require("./life-cycles/tui-summary-life-cycle");
const task_graph_utils_1 = require("./task-graph-utils");
const utils_1 = require("./utils");
const exit_codes_1 = require("../utils/exit-codes");
const handle_import_1 = require("../utils/handle-import");
const pc = tslib_1.__importStar(require("picocolors"));
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
async function getTerminalOutputLifeCycle(initiatingProject, initiatingTasks, projectNames, tasks, taskGraph, nxArgs, nxJson, overrides) {
    const overridesWithoutHidden = { ...overrides };
    delete overridesWithoutHidden['__overrides_unparsed__'];
    const isRunOne = initiatingProject != null;
    if (tasks.length === 1 && !is_tui_enabled_1.ORIGINAL_TUI_ENV_VALUE) {
        process.env.NX_TUI = 'false';
    }
    if ((0, is_tui_enabled_1.isTuiEnabled)()) {
        const interceptedNxCloudLogs = [];
        const createPatchedConsoleMethod = (originalMethod) => {
            return (...args) => {
                // Check if the log came from the Nx Cloud client, otherwise invoke the original write method
                const stackTrace = new Error().stack;
                const isNxCloudLog = stackTrace.includes((0, node_path_1.join)(workspace_root_1.workspaceRoot, '.nx', 'cache', 'cloud'));
                if (!isNxCloudLog) {
                    return originalMethod(...args);
                }
                // No-op the Nx Cloud client logs
            };
        };
        // The cloud client calls console.log when NX_VERBOSE_LOGGING is set to true
        console.log = createPatchedConsoleMethod(originalConsoleLog);
        console.error = createPatchedConsoleMethod(originalConsoleError);
        const patchedWrite = (_chunk, _encoding, callback) => {
            // Preserve original behavior around callback and return value, just in case
            if (callback) {
                callback();
            }
            return true;
        };
        process.stdout.write = patchedWrite;
        process.stderr.write = patchedWrite;
        const { AppLifeCycle, restoreTerminal } = await (0, handle_import_1.handleImport)('../native/index.js', __dirname);
        let appLifeCycle;
        const isRunOne = initiatingProject != null;
        const pinnedTasks = [];
        let titleText = '';
        if (isRunOne) {
            const mainTaskId = initiatingTasks[0].id;
            pinnedTasks.push(mainTaskId);
            const mainContinuousDependencies = taskGraph.continuousDependencies[mainTaskId];
            if (mainContinuousDependencies.length > 0) {
                pinnedTasks.push(mainContinuousDependencies[0]);
            }
            const [, target] = mainTaskId.split(':');
            titleText = `1 ${target} task`;
            if (tasks.length > 1) {
                const dependentTasksCount = tasks.length - 1;
                const dependentTaskText = dependentTasksCount === 1 ? 'other' : 'others';
                titleText += `, and ${dependentTasksCount} ${dependentTaskText} they depend on`;
            }
        }
        else {
            const mainTasksCount = projectNames.length;
            const targetText = nxArgs.targets.join(', ');
            const mainTaskText = mainTasksCount === 1 ? 'task' : 'tasks';
            titleText = `${mainTasksCount} ${targetText} ${mainTaskText}`;
            if (tasks.length > projectNames.length) {
                const dependentTasksCount = tasks.length - projectNames.length;
                const dependentTaskText = dependentTasksCount === 1 ? 'other' : 'others';
                titleText += `, and ${dependentTasksCount} ${dependentTaskText} they depend on`;
            }
        }
        let resolveRenderIsDonePromise;
        // Default renderIsDone that will be overridden if the TUI is used
        let renderIsDone = new Promise((resolve) => (resolveRenderIsDonePromise = resolve));
        const { lifeCycle: tsLifeCycle, printSummary } = (0, tui_summary_life_cycle_1.getTuiTerminalSummaryLifeCycle)({
            projectNames,
            tasks,
            taskGraph,
            args: nxArgs,
            overrides: overridesWithoutHidden,
            initiatingProject,
            initiatingTasks,
            resolveRenderIsDonePromise,
        });
        if (tasks.length === 0) {
            renderIsDone = renderIsDone.then(() => {
                // Revert the patched methods
                process.stdout.write = originalStdoutWrite;
                process.stderr.write = originalStderrWrite;
                console.log = originalConsoleLog;
                console.error = originalConsoleError;
            });
        }
        const lifeCycles = [tsLifeCycle];
        // Only run the TUI if there are tasks to run
        if (tasks.length > 0) {
            appLifeCycle = new AppLifeCycle(tasks, initiatingTasks.map((t) => t.id), isRunOne ? 0 /* RunMode.RunOne */ : 1 /* RunMode.RunMany */, pinnedTasks, nxArgs ?? {}, nxJson.tui ?? {}, titleText, workspace_root_1.workspaceRoot, taskGraph);
            lifeCycles.unshift(appLifeCycle);
            /**
             * Patch stdout.write and stderr.write methods to pass Nx Cloud client logs to the TUI via the lifecycle
             */
            const createPatchedLogWrite = (originalWrite, isError) => {
                // @ts-ignore
                return (chunk, encoding, callback) => {
                    if (isError) {
                        (0, native_1.logDebug)(Buffer.isBuffer(chunk)
                            ? chunk.toString(encoding)
                            : chunk.toString());
                    }
                    else {
                        (0, native_1.logDebug)(Buffer.isBuffer(chunk)
                            ? chunk.toString(encoding)
                            : chunk.toString());
                    }
                    // Check if the log came from the Nx Cloud client, otherwise invoke the original write method
                    const stackTrace = new Error().stack;
                    const isNxCloudLog = stackTrace.includes((0, node_path_1.join)(workspace_root_1.workspaceRoot, '.nx', 'cache', 'cloud'));
                    if (isNxCloudLog) {
                        interceptedNxCloudLogs.push(chunk);
                        // Do not bother to store logs with only whitespace characters, they aren't relevant for the TUI
                        const trimmedChunk = chunk.toString().trim();
                        if (trimmedChunk.length) {
                            // Remove ANSI escape codes, the TUI will control the formatting
                            // NOTE: this shows any message from the Nx Cloud client, including errors
                            appLifeCycle?.__setCloudMessage((0, node_util_1.stripVTControlCharacters)(trimmedChunk));
                        }
                    }
                    // Preserve original behavior around callback and return value, just in case
                    if (callback) {
                        callback();
                    }
                    return true;
                };
            };
            const createPatchedConsoleMethod = (originalMethod) => {
                return (...args) => {
                    // Check if the log came from the Nx Cloud client, otherwise invoke the original write method
                    const stackTrace = new Error().stack;
                    const isNxCloudLog = stackTrace.includes((0, node_path_1.join)(workspace_root_1.workspaceRoot, '.nx', 'cache', 'cloud'));
                    if (!isNxCloudLog) {
                        return originalMethod(...args);
                    }
                    // No-op the Nx Cloud client logs
                };
            };
            process.stdout.write = createPatchedLogWrite(originalStdoutWrite, false);
            process.stderr.write = createPatchedLogWrite(originalStderrWrite, true);
            // The cloud client calls console.log when NX_VERBOSE_LOGGING is set to true
            console.log = createPatchedConsoleMethod(originalConsoleLog);
            console.error = createPatchedConsoleMethod(originalConsoleError);
            globalThis.tuiOnProcessExit = () => {
                restoreTerminal();
                // Revert the patched methods
                process.stdout.write = originalStdoutWrite;
                process.stderr.write = originalStderrWrite;
                console.log = originalConsoleLog;
                console.error = originalConsoleError;
                process.stdout.write('\n');
                // Print the intercepted Nx Cloud logs
                for (const log of interceptedNxCloudLogs) {
                    const logString = log.toString().trimStart();
                    process.stdout.write(logString);
                    if (logString) {
                        process.stdout.write('\n');
                    }
                }
            };
            renderIsDone = new Promise((resolve) => {
                appLifeCycle.__init(() => {
                    resolve();
                });
            });
        }
        return {
            lifeCycle: new life_cycle_1.CompositeLifeCycle(lifeCycles),
            restoreTerminal: () => {
                process.stdout.write = originalStdoutWrite;
                process.stderr.write = originalStderrWrite;
                console.log = originalConsoleLog;
                console.error = originalConsoleError;
                restoreTerminal();
            },
            printSummary: () => printSummary(),
            renderIsDone,
        };
    }
    const { runnerOptions } = getRunner(nxArgs, nxJson);
    const useDynamicOutput = shouldUseDynamicLifeCycle(tasks, runnerOptions, nxArgs.outputStyle);
    if (isRunOne) {
        if (useDynamicOutput) {
            return await (0, dynamic_run_one_terminal_output_life_cycle_1.createRunOneDynamicOutputRenderer)({
                initiatingProject,
                tasks,
                args: nxArgs,
                overrides: overridesWithoutHidden,
            });
        }
        return {
            lifeCycle: new static_run_one_terminal_output_life_cycle_1.StaticRunOneTerminalOutputLifeCycle(initiatingProject, projectNames, tasks, nxArgs),
            renderIsDone: Promise.resolve(),
        };
    }
    else {
        if (useDynamicOutput) {
            return await (0, dynamic_run_many_terminal_output_life_cycle_1.createRunManyDynamicOutputRenderer)({
                projectNames,
                tasks,
                args: nxArgs,
                overrides: overridesWithoutHidden,
            });
        }
        else {
            return {
                lifeCycle: new static_run_many_terminal_output_life_cycle_1.StaticRunManyTerminalOutputLifeCycle(projectNames, tasks, nxArgs, overridesWithoutHidden),
                renderIsDone: Promise.resolve(),
            };
        }
    }
}
function createTaskGraphAndRunValidations(projectGraph, extraTargetDependencies, projectNames, nxArgs, overrides, extraOptions) {
    const taskGraph = (0, create_task_graph_1.createTaskGraph)(projectGraph, extraTargetDependencies, projectNames, nxArgs.targets, nxArgs.configuration, overrides, extraOptions.excludeTaskDependencies);
    (0, task_graph_utils_1.assertTaskGraphDoesNotContainInvalidTargets)(taskGraph);
    const cycle = (0, task_graph_utils_1.findCycle)(taskGraph);
    if (cycle) {
        if (process.env.NX_IGNORE_CYCLES === 'true' || nxArgs.nxIgnoreCycles) {
            output_1.output.warn({
                title: `The task graph has a circular dependency`,
                bodyLines: [`${cycle.join(' --> ')}`],
            });
            (0, task_graph_utils_1.makeAcyclic)(taskGraph);
        }
        else {
            output_1.output.error({
                title: `Could not execute command because the task graph has a circular dependency`,
                bodyLines: [`${cycle.join(' --> ')}`],
            });
            process.exit(1);
        }
    }
    // validate that no atomized tasks like e2e-ci are used without Nx Cloud
    if (!(0, nx_cloud_utils_1.isNxCloudUsed)((0, nx_json_1.readNxJson)()) &&
        !process.env['NX_SKIP_ATOMIZER_VALIDATION']) {
        (0, task_graph_utils_1.validateNoAtomizedTasks)(taskGraph, projectGraph);
    }
    return taskGraph;
}
async function runCommand(projectsToRun, currentProjectGraph, { nxJson }, nxArgs, overrides, initiatingProject, extraTargetDependencies, extraOptions) {
    const status = await (0, handle_errors_1.handleErrors)(process.env.NX_VERBOSE_LOGGING === 'true', async () => {
        const id = (0, native_1.hashArray)([...process.argv, Date.now().toString()]);
        await (0, tasks_execution_hooks_1.runPreTasksExecution)({
            id,
            workspaceRoot: workspace_root_1.workspaceRoot,
            nxJsonConfiguration: nxJson,
            argv: process.argv,
        });
        const startTime = Date.now();
        const { taskResults, completed } = await runCommandForTasks(projectsToRun, currentProjectGraph, { nxJson }, {
            ...nxArgs,
            skipNxCache: nxArgs.skipNxCache ||
                process.env.NX_SKIP_NX_CACHE === 'true' ||
                process.env.NX_DISABLE_NX_CACHE === 'true',
        }, overrides, initiatingProject, extraTargetDependencies, extraOptions);
        const endTime = Date.now();
        const exitCode = !completed
            ? (0, exit_codes_1.signalToCode)('SIGINT')
            : Object.values(taskResults).some((taskResult) => taskResult.status === 'failure' ||
                taskResult.status === 'skipped')
                ? 1
                : 0;
        await (0, tasks_execution_hooks_1.runPostTasksExecution)({
            id,
            taskResults,
            workspaceRoot: workspace_root_1.workspaceRoot,
            nxJsonConfiguration: nxJson,
            argv: process.argv,
            startTime,
            endTime,
        });
        return exitCode;
    });
    return status;
}
async function runCommandForTasks(projectsToRun, currentProjectGraph, { nxJson }, nxArgs, overrides, initiatingProject, extraTargetDependencies, extraOptions) {
    // Kick off the license lookup in the background so it overlaps with task
    // execution. The log itself is deferred to the print site below so it
    // never lands in the middle of task output.
    const nxKeyPromise = (0, nx_key_1.getNxKeyInformation)().catch(() => null);
    const projectNames = projectsToRun.map((t) => t.name);
    const projectNameSet = new Set(projectNames);
    const { projectGraph, taskGraph } = await ensureWorkspaceIsInSyncAndGetGraphs(currentProjectGraph, nxJson, projectNames, nxArgs, overrides, extraTargetDependencies, extraOptions);
    const tasks = Object.values(taskGraph.tasks);
    const initiatingTasks = tasks.filter((t) => projectNameSet.has(t.target.project) &&
        nxArgs.targets.includes(t.target.target));
    const { lifeCycle, renderIsDone, printSummary, restoreTerminal } = await getTerminalOutputLifeCycle(initiatingProject, initiatingTasks, projectNames, tasks, taskGraph, nxArgs, nxJson, overrides);
    try {
        const taskResults = await invokeTasksRunner({
            tasks,
            projectGraph,
            taskGraph,
            lifeCycle,
            nxJson,
            nxArgs,
            loadDotEnvFiles: extraOptions.loadDotEnvFiles,
            initiatingProject,
            initiatingTasks,
        });
        await renderIsDone.finally(() => restoreTerminal?.());
        if (printSummary) {
            printSummary();
        }
        await printConfigureAiAgentsDisclaimer();
        const nxKey = await nxKeyPromise;
        if (nxKey)
            logger_1.logger.log((0, nx_key_1.createNxKeyLicenseeInformation)(nxKey));
        return {
            taskResults,
            completed: didCommandComplete(tasks, taskResults),
        };
    }
    catch (e) {
        restoreTerminal?.();
        throw e;
    }
}
async function printConfigureAiAgentsDisclaimer() {
    try {
        if (!client_1.daemonClient.enabled() || !(await client_1.daemonClient.isServerAvailable())) {
            return;
        }
        const { outdatedAgents } = await client_1.daemonClient.getConfigureAiAgentsStatus();
        if (outdatedAgents.length > 0) {
            output_1.output.logRawLine(output_1.output.dim('Your AI agent configuration is outdated. Run "nx configure-ai-agents" to update.'));
        }
    }
    catch {
        // Silently ignore errors
    }
}
function didCommandComplete(tasks, taskResults) {
    if (tasks.length === 0)
        return true;
    for (const task of tasks) {
        if (!task.continuous) {
            // Discrete task must have a result (was started and finished)
            if (!taskResults[task.id])
                return false;
        }
    }
    // Any stopped task means the run was interrupted
    return !Object.values(taskResults).some((r) => r.status === 'stopped');
}
async function ensureWorkspaceIsInSyncAndGetGraphs(projectGraph, nxJson, projectNames, nxArgs, overrides, extraTargetDependencies, extraOptions) {
    let taskGraph = createTaskGraphAndRunValidations(projectGraph, extraTargetDependencies ?? {}, projectNames, nxArgs, overrides, extraOptions);
    if (nxArgs.skipSync || (0, is_ci_1.isCI)()) {
        return { projectGraph, taskGraph };
    }
    // collect unique syncGenerators from the tasks
    const uniqueSyncGenerators = (0, sync_generators_1.collectEnabledTaskSyncGeneratorsFromTaskGraph)(taskGraph, projectGraph, nxJson);
    if (!uniqueSyncGenerators.size) {
        // There are no sync generators registered in the tasks to run
        return { projectGraph, taskGraph };
    }
    const syncGenerators = Array.from(uniqueSyncGenerators);
    const results = await (0, sync_generators_1.getSyncGeneratorChanges)(syncGenerators);
    if (!results.length) {
        // There are no changes to sync, workspace is up to date
        return { projectGraph, taskGraph };
    }
    const { failedGeneratorsCount, areAllResultsFailures, anySyncGeneratorsFailed, } = (0, sync_generators_1.processSyncGeneratorResultErrors)(results);
    const failedSyncGeneratorsFixMessageLines = (0, sync_generators_1.getFailedSyncGeneratorsFixMessageLines)(results, nxArgs.verbose);
    const outOfSyncTitle = 'The workspace is out of sync';
    const resultBodyLines = (0, sync_generators_1.getSyncGeneratorSuccessResultsMessageLines)(results);
    const fixMessage = 'Make sure to run `nx sync` to apply the identified changes or set `sync.applyChanges` to `true` in your `nx.json` to apply them automatically when running tasks in interactive environments.';
    if (!process.stdout.isTTY) {
        // If the user is running a non-TTY environment we
        // throw an error to stop the execution of the tasks.
        if (areAllResultsFailures) {
            output_1.output.error({
                title: `The workspace is probably out of sync because ${failedGeneratorsCount === 1
                    ? 'a sync generator'
                    : 'some sync generators'} failed to run`,
                bodyLines: failedSyncGeneratorsFixMessageLines,
            });
        }
        else {
            output_1.output.error({
                title: outOfSyncTitle,
                bodyLines: [...resultBodyLines, '', fixMessage],
            });
            if (anySyncGeneratorsFailed) {
                output_1.output.error({
                    title: failedGeneratorsCount === 1
                        ? 'A sync generator failed to run'
                        : 'Some sync generators failed to run',
                    bodyLines: failedSyncGeneratorsFixMessageLines,
                });
            }
        }
        process.exit(1);
    }
    if (areAllResultsFailures) {
        output_1.output.warn({
            title: `The workspace is probably out of sync because ${failedGeneratorsCount === 1
                ? 'a sync generator'
                : 'some sync generators'} failed to run`,
            bodyLines: failedSyncGeneratorsFixMessageLines,
        });
        await confirmRunningTasksWithSyncFailures();
        // if all sync generators failed to run there's nothing to sync, we just let the tasks run
        return { projectGraph, taskGraph };
    }
    if (nxJson.sync?.applyChanges === false) {
        // If the user has set `sync.applyChanges` to `false` in their `nx.json`
        // we don't prompt the them and just log a warning informing them that
        // the workspace is out of sync and they have it set to not apply changes
        // automatically.
        output_1.output.warn({
            title: outOfSyncTitle,
            bodyLines: [
                ...resultBodyLines,
                '',
                'Your workspace is set to not apply the identified changes automatically (`sync.applyChanges` is set to `false` in your `nx.json`).',
                fixMessage,
            ],
        });
        if (anySyncGeneratorsFailed) {
            output_1.output.warn({
                title: failedGeneratorsCount === 1
                    ? 'A sync generator failed to run'
                    : 'Some sync generators failed to run',
                bodyLines: failedSyncGeneratorsFixMessageLines,
            });
            await confirmRunningTasksWithSyncFailures();
        }
        return { projectGraph, taskGraph };
    }
    output_1.output.warn({
        title: outOfSyncTitle,
        bodyLines: [
            ...resultBodyLines,
            ...(nxJson.sync?.applyChanges === true
                ? [
                    '',
                    'Proceeding to sync the identified changes automatically (`sync.applyChanges` is set to `true` in your `nx.json`).',
                ]
                : []),
        ],
    });
    const applyChanges = nxJson.sync?.applyChanges === true ||
        (await promptForApplyingSyncGeneratorChanges());
    if (applyChanges) {
        const spinner = spinner_1.globalSpinner.start('Syncing the workspace...');
        // Flush sync generator changes to disk
        const flushResult = await (0, sync_generators_1.flushSyncGeneratorChanges)(results);
        if ('generatorFailures' in flushResult) {
            spinner.fail();
            output_1.output.error({
                title: 'Failed to sync the workspace',
                bodyLines: [
                    ...(0, sync_generators_1.getFlushFailureMessageLines)(flushResult, nxArgs.verbose),
                    ...(flushResult.generalFailure
                        ? [
                            'If needed, you can run the tasks with the `--skip-sync` flag to disable syncing.',
                        ]
                        : []),
                ],
            });
            await confirmRunningTasksWithSyncFailures();
        }
        // Re-create project graph and task graph
        projectGraph = await (0, project_graph_1.createProjectGraphAsync)();
        taskGraph = createTaskGraphAndRunValidations(projectGraph, extraTargetDependencies ?? {}, projectNames, nxArgs, overrides, extraOptions);
        const successTitle = anySyncGeneratorsFailed
            ? // the identified changes were synced successfully, but the workspace
                // is still not up to date, which we'll mention next
                'The identified changes were synced successfully!'
            : // the workspace is fully up to date
                'The workspace was synced successfully!';
        const successSubtitle = nxJson.sync?.applyChanges === true
            ? 'Please make sure to commit the changes to your repository or this will error in CI.'
            : // The user was prompted and we already logged a message about erroring in CI
                // so here we just tell them to commit the changes.
                'Please make sure to commit the changes to your repository.';
        spinner.succeed(`${successTitle}\n\n${successSubtitle}`);
        if (anySyncGeneratorsFailed) {
            output_1.output.warn({
                title: `The workspace is probably still out of sync because ${failedGeneratorsCount === 1
                    ? 'a sync generator'
                    : 'some sync generators'} failed to run`,
                bodyLines: failedSyncGeneratorsFixMessageLines,
            });
            await confirmRunningTasksWithSyncFailures();
        }
    }
    else {
        if (anySyncGeneratorsFailed) {
            output_1.output.warn({
                title: failedGeneratorsCount === 1
                    ? 'A sync generator failed to report the sync status'
                    : 'Some sync generators failed to report the sync status',
                bodyLines: failedSyncGeneratorsFixMessageLines,
            });
            await confirmRunningTasksWithSyncFailures();
        }
        else {
            output_1.output.warn({
                title: 'Syncing the workspace was skipped',
                bodyLines: [
                    'This could lead to unexpected results or errors when running tasks.',
                    fixMessage,
                ],
            });
        }
    }
    return { projectGraph, taskGraph };
}
async function promptForApplyingSyncGeneratorChanges() {
    try {
        const promptConfig = {
            name: 'applyChanges',
            type: 'autocomplete',
            message: 'Would you like to sync the identified changes to get your workspace up to date?',
            choices: [
                {
                    name: 'yes',
                    message: 'Yes, sync the changes and run the tasks',
                },
                {
                    name: 'no',
                    message: 'No, run the tasks without syncing the changes',
                },
            ],
            footer: () => pc.dim('\nYou can skip this prompt by setting the `sync.applyChanges` option to `true` in your `nx.json`.\nFor more information, refer to the docs: https://nx.dev/concepts/sync-generators.'),
        };
        return await (0, enquirer_1.prompt)([promptConfig]).then(({ applyChanges }) => applyChanges === 'yes');
    }
    catch {
        process.exit(1);
    }
}
async function confirmRunningTasksWithSyncFailures() {
    try {
        const promptConfig = {
            name: 'runTasks',
            type: 'autocomplete',
            message: 'Would you like to ignore the sync failures and continue running the tasks?',
            choices: [
                {
                    name: 'yes',
                    message: 'Yes, ignore the failures and run the tasks',
                },
                {
                    name: 'no',
                    message: `No, don't run the tasks`,
                },
            ],
            footer: () => pc.dim(`\nWhen running in CI and there are sync failures, the tasks won't run. Addressing the errors above is highly recommended to prevent failures in CI.`),
        };
        const runTasks = await (0, enquirer_1.prompt)([
            promptConfig,
        ]).then(({ runTasks }) => runTasks === 'yes');
        if (!runTasks) {
            process.exit(1);
        }
    }
    catch {
        process.exit(1);
    }
}
function setEnvVarsBasedOnArgs(nxArgs, loadDotEnvFiles) {
    if (nxArgs.outputStyle == 'stream' ||
        process.env.NX_BATCH_MODE === 'true' ||
        nxArgs.batch) {
        process.env.NX_STREAM_OUTPUT = 'true';
        process.env.NX_PREFIX_OUTPUT = 'true';
    }
    if (nxArgs.outputStyle == 'stream-without-prefixes') {
        process.env.NX_STREAM_OUTPUT = 'true';
        process.env.NX_PREFIX_OUTPUT = 'false';
    }
    // Force streaming only when the TUI is active, so it can capture and
    // render task output. Other output styles manage their own streaming.
    if ((0, is_tui_enabled_1.isTuiEnabled)()) {
        process.env.NX_STREAM_OUTPUT = 'true';
    }
    if (loadDotEnvFiles) {
        process.env.NX_LOAD_DOT_ENV_FILES = 'true';
    }
}
async function invokeTasksRunner({ tasks, projectGraph, taskGraph, lifeCycle, nxJson, nxArgs, loadDotEnvFiles, initiatingProject, initiatingTasks, }) {
    setEnvVarsBasedOnArgs(nxArgs, loadDotEnvFiles);
    // this needs to be done before we start to run the tasks
    const taskDetails = (0, hash_task_1.getTaskDetails)();
    const { tasksRunner, runnerOptions } = getRunner(nxArgs, nxJson);
    let hasher = (0, create_task_hasher_1.createTaskHasher)(projectGraph, nxJson, runnerOptions);
    // this is used for two reasons: to fetch all remote cache hits AND
    // to submit everything that is known in advance to Nx Cloud to run in
    // a distributed fashion
    await (0, hash_task_1.hashTasksThatDoNotDependOnOutputsOfOtherTasks)(hasher, projectGraph, taskGraph, nxJson, taskDetails);
    const taskResultsLifecycle = new task_results_life_cycle_1.TaskResultsLifeCycle();
    const compositedLifeCycle = new life_cycle_1.CompositeLifeCycle([
        ...constructLifeCycles(lifeCycle),
        taskResultsLifecycle,
    ]);
    let promiseOrObservable = tasksRunner(tasks, {
        ...runnerOptions,
        lifeCycle: compositedLifeCycle,
    }, {
        initiatingProject,
        initiatingTasks,
        projectGraph,
        nxJson,
        nxArgs,
        taskGraph,
        hasher: {
            hashTask(task, taskGraph_, env) {
                if (!taskGraph_) {
                    output_1.output.warn({
                        title: `TaskGraph is now required as an argument to hashTask`,
                        bodyLines: [
                            `The TaskGraph object can be retrieved from the context`,
                            'This will result in an error in Nx 20',
                        ],
                    });
                    taskGraph_ = taskGraph;
                }
                if (!env) {
                    output_1.output.warn({
                        title: `The environment variables are now required as an argument to hashTask`,
                        bodyLines: [
                            `Please pass the environment variables used when running the task`,
                            'This will result in an error in Nx 20',
                        ],
                    });
                    env = process.env;
                }
                return hasher.hashTask(task, taskGraph_, env);
            },
            hashTasks(tasks, taskGraph_, envOrPerTaskEnvs) {
                if (!taskGraph_) {
                    output_1.output.warn({
                        title: `TaskGraph is now required as an argument to hashTasks`,
                        bodyLines: [
                            `The TaskGraph object can be retrieved from the context`,
                            'This will result in an error in Nx 20',
                        ],
                    });
                    taskGraph_ = taskGraph;
                }
                if (!envOrPerTaskEnvs) {
                    output_1.output.warn({
                        title: `The environment variables are now required as an argument to hashTasks`,
                        bodyLines: [
                            `Please pass the environment variables used when running the tasks`,
                            'This will result in an error in Nx 20',
                        ],
                    });
                    envOrPerTaskEnvs = process.env;
                }
                // hasher.hashTasks accepts either legacy single-env or the new
                // per-task-env shape and normalizes internally.
                return hasher.hashTasks(tasks, taskGraph_, envOrPerTaskEnvs);
            },
        },
        daemon: client_1.daemonClient,
    });
    if (promiseOrObservable.subscribe) {
        promiseOrObservable = convertObservableToPromise(promiseOrObservable);
    }
    await promiseOrObservable;
    return taskResultsLifecycle.getTaskResults();
}
function constructLifeCycles(lifeCycle) {
    const lifeCycles = [];
    lifeCycles.push(new store_run_information_life_cycle_1.StoreRunInformationLifeCycle());
    lifeCycles.push(lifeCycle);
    if (process.env.NX_PERF_LOGGING === 'true') {
        lifeCycles.push(new task_timings_life_cycle_1.TaskTimingsLifeCycle());
    }
    if (process.env.NX_PROFILE) {
        lifeCycles.push(new task_profiling_life_cycle_1.TaskProfilingLifeCycle(process.env.NX_PROFILE));
    }
    lifeCycles.push(new task_telemetry_life_cycle_1.TaskTelemetryLifeCycle());
    const historyLifeCycle = (0, task_history_life_cycle_1.getTasksHistoryLifeCycle)();
    lifeCycles.push(historyLifeCycle);
    return lifeCycles;
}
async function convertObservableToPromise(obs) {
    return await new Promise((res) => {
        let tasksResults = {};
        obs.subscribe({
            next: (t) => {
                tasksResults[t.task.id] = t.success ? 'success' : 'failure';
            },
            error: (error) => {
                output_1.output.error({
                    title: 'Unhandled error in task executor',
                });
                console.error(error);
                res(tasksResults);
            },
            complete: () => {
                res(tasksResults);
            },
        });
    });
}
function shouldUseDynamicLifeCycle(tasks, options, outputStyle) {
    if (process.env.NX_BATCH_MODE === 'true' ||
        process.env.NX_VERBOSE_LOGGING === 'true' ||
        process.env.NX_TASKS_RUNNER_DYNAMIC_OUTPUT === 'false') {
        return false;
    }
    if (!process.stdout.isTTY)
        return false;
    if ((0, is_ci_1.isCI)())
        return false;
    if (outputStyle === 'static' ||
        outputStyle === 'stream' ||
        outputStyle === 'stream-without-prefixes')
        return false;
    return !tasks.find((t) => (0, utils_1.shouldStreamOutput)(t, null));
}
function loadTasksRunner(modulePath) {
    try {
        const maybeTasksRunner = require(modulePath);
        // to support both babel and ts formats
        return 'default' in maybeTasksRunner
            ? maybeTasksRunner.default
            : maybeTasksRunner;
    }
    catch (e) {
        if (e.code === 'MODULE_NOT_FOUND' &&
            (modulePath === 'nx-cloud' || modulePath === '@nrwl/nx-cloud')) {
            return require('../nx-cloud/nx-cloud-tasks-runner-shell')
                .nxCloudTasksRunnerShell;
        }
        throw e;
    }
}
function getRunner(nxArgs, nxJson) {
    let runner = nxArgs.runner;
    runner = runner ?? 'default';
    if (runner !== 'default' && !nxJson.tasksRunnerOptions?.[runner]) {
        throw new Error(`Could not find runner configuration for ${runner}`);
    }
    const modulePath = getTasksRunnerPath(runner, nxJson);
    try {
        const tasksRunner = loadTasksRunner(modulePath);
        return {
            tasksRunner,
            runnerOptions: getRunnerOptions(runner, nxJson, nxArgs, modulePath === 'nx-cloud'),
        };
    }
    catch {
        throw new Error(`Could not find runner configuration for ${runner}`);
    }
}
const defaultTasksRunnerPath = require.resolve('./default-tasks-runner');
function getTasksRunnerPath(runner, nxJson) {
    // If running inside of Codex, there will be no internet access, so we cannot use the cloud runner, regardless of other config.
    // We can infer this scenario by checking for certain environment variables defined in their base image: https://github.com/openai/codex-universal
    if (process.env.CODEX_ENV_NODE_VERSION) {
        output_1.output.warn({
            title: 'Codex environment detected, using default tasks runner',
            bodyLines: [
                'Codex does not have internet access when it runs tasks, so Nx will use the default tasks runner and only leverage local caching.',
            ],
        });
        return defaultTasksRunnerPath;
    }
    const isCloudRunner = 
    // No tasksRunnerOptions for given --runner
    nxJson.nxCloudAccessToken ||
        // No runner prop in tasks runner options, check if access token is set.
        nxJson.tasksRunnerOptions?.[runner]?.options?.accessToken ||
        ['nx-cloud', '@nrwl/nx-cloud'].includes(nxJson.tasksRunnerOptions?.[runner]?.runner) ||
        // Cloud access token specified in env var.
        process.env.NX_CLOUD_AUTH_TOKEN ||
        process.env.NX_CLOUD_ACCESS_TOKEN ||
        // Nx Cloud ID specified in nxJson
        nxJson.nxCloudId;
    // NX_NO_CLOUD / neverConnectToCloud wins over any ambient token — otherwise
    // a surrounding CI env variable would still route through the cloud shell,
    // which resolves the default tasks runner via its own require bridge and
    // can pull in a different Nx version than the workspace's own.
    return isCloudRunner && !(0, nx_cloud_utils_1.isNxCloudDisabled)(nxJson)
        ? 'nx-cloud'
        : defaultTasksRunnerPath;
}
function getRunnerOptions(runner, nxJson, nxArgs, isCloudDefault) {
    const defaultCacheableOperations = [];
    for (const key in nxJson.targetDefaults) {
        if (nxJson.targetDefaults[key].cache) {
            defaultCacheableOperations.push(key);
        }
    }
    const result = {
        ...nxJson.tasksRunnerOptions?.[runner]?.options,
        ...nxArgs,
    };
    // NOTE: we don't pull from env here because the cloud package
    // supports it within nx-cloud's implementation. We could
    // normalize it here, and that may make more sense, but
    // leaving it as is for now.
    if (nxJson.nxCloudAccessToken && isCloudDefault) {
        result.accessToken ??= nxJson.nxCloudAccessToken;
    }
    if (nxJson.nxCloudId && isCloudDefault) {
        result.nxCloudId ??= nxJson.nxCloudId;
    }
    if (nxJson.nxCloudUrl && isCloudDefault) {
        result.url ??= nxJson.nxCloudUrl;
    }
    if (nxJson.nxCloudEncryptionKey && isCloudDefault) {
        result.encryptionKey ??= nxJson.nxCloudEncryptionKey;
    }
    if (nxJson.parallel) {
        result.parallel ??= nxJson.parallel;
    }
    if (nxJson.cacheDirectory) {
        result.cacheDirectory ??= nxJson.cacheDirectory;
    }
    if (defaultCacheableOperations.length) {
        result.cacheableOperations ??= [];
        result.cacheableOperations = result.cacheableOperations.concat(defaultCacheableOperations);
    }
    if (nxJson.useDaemonProcess !== undefined) {
        result.useDaemonProcess ??= nxJson.useDaemonProcess;
    }
    return result;
}
