"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncError = void 0;
exports.getSyncGeneratorChanges = getSyncGeneratorChanges;
exports.flushSyncGeneratorChanges = flushSyncGeneratorChanges;
exports.collectAllRegisteredSyncGenerators = collectAllRegisteredSyncGenerators;
exports.runSyncGenerator = runSyncGenerator;
exports.collectEnabledTaskSyncGeneratorsFromProjectGraph = collectEnabledTaskSyncGeneratorsFromProjectGraph;
exports.collectEnabledTaskSyncGeneratorsFromTaskGraph = collectEnabledTaskSyncGeneratorsFromTaskGraph;
exports.collectRegisteredGlobalSyncGenerators = collectRegisteredGlobalSyncGenerators;
exports.getSyncGeneratorSuccessResultsMessageLines = getSyncGeneratorSuccessResultsMessageLines;
exports.getFailedSyncGeneratorsFixMessageLines = getFailedSyncGeneratorsFixMessageLines;
exports.getFlushFailureMessageLines = getFlushFailureMessageLines;
exports.processSyncGeneratorResultErrors = processSyncGeneratorResultErrors;
const tslib_1 = require("tslib");
const perf_hooks_1 = require("perf_hooks");
const generate_1 = require("../command-line/generate/generate");
const generator_utils_1 = require("../command-line/generate/generator-utils");
const nx_json_1 = require("../config/nx-json");
const client_1 = require("../daemon/client/client");
const is_on_daemon_1 = require("../daemon/is-on-daemon");
const tree_1 = require("../generators/tree");
const project_graph_1 = require("../project-graph/project-graph");
const workspace_context_1 = require("./workspace-context");
const workspace_root_1 = require("./workspace-root");
const pc = tslib_1.__importStar(require("picocolors"));
class SyncError extends Error {
    constructor(title, bodyLines) {
        super(title);
        this.title = title;
        this.bodyLines = bodyLines;
        this.name = this.constructor.name;
    }
}
exports.SyncError = SyncError;
async function getSyncGeneratorChanges(generators) {
    perf_hooks_1.performance.mark('get-sync-generators-changes:start');
    let results;
    if (!client_1.daemonClient.enabled()) {
        results = await runSyncGenerators(generators);
    }
    else {
        results = await client_1.daemonClient.getSyncGeneratorChanges(generators);
    }
    perf_hooks_1.performance.mark('get-sync-generators-changes:end');
    perf_hooks_1.performance.measure('get-sync-generators-changes', 'get-sync-generators-changes:start', 'get-sync-generators-changes:end');
    return results.filter((r) => ('error' in r ? true : r.changes.length > 0));
}
async function flushSyncGeneratorChanges(results) {
    if ((0, is_on_daemon_1.isOnDaemon)() || !client_1.daemonClient.enabled()) {
        return await flushSyncGeneratorChangesToDisk(results);
    }
    return await client_1.daemonClient.flushSyncGeneratorChangesToDisk(results.map((r) => r.generatorName));
}
async function collectAllRegisteredSyncGenerators(projectGraph, nxJson) {
    if (!client_1.daemonClient.enabled()) {
        return {
            globalGenerators: [...collectRegisteredGlobalSyncGenerators()],
            taskGenerators: [
                ...collectEnabledTaskSyncGeneratorsFromProjectGraph(projectGraph, nxJson),
            ],
        };
    }
    return await client_1.daemonClient.getRegisteredSyncGenerators();
}
async function runSyncGenerator(tree, generatorSpecifier, projects) {
    try {
        perf_hooks_1.performance.mark(`run-sync-generator:${generatorSpecifier}:start`);
        const { collection, generator } = (0, generate_1.parseGeneratorString)(generatorSpecifier);
        const { implementationFactory } = (0, generator_utils_1.getGeneratorInformation)(collection, generator, workspace_root_1.workspaceRoot, projects);
        const implementation = implementationFactory();
        const result = await implementation(tree);
        let callback;
        let outOfSyncMessage;
        let outOfSyncDetails;
        if (result && typeof result === 'object') {
            callback = result.callback;
            outOfSyncMessage = result.outOfSyncMessage;
            outOfSyncDetails = result.outOfSyncDetails;
        }
        perf_hooks_1.performance.mark(`run-sync-generator:${generatorSpecifier}:end`);
        perf_hooks_1.performance.measure(`run-sync-generator:${generatorSpecifier}`, `run-sync-generator:${generatorSpecifier}:start`, `run-sync-generator:${generatorSpecifier}:end`);
        return {
            changes: tree.listChanges(),
            generatorName: generatorSpecifier,
            callback,
            outOfSyncMessage,
            outOfSyncDetails,
        };
    }
    catch (e) {
        return {
            generatorName: generatorSpecifier,
            error: toSerializableError(e),
        };
    }
}
function collectEnabledTaskSyncGeneratorsFromProjectGraph(projectGraph, nxJson) {
    const taskSyncGenerators = new Set();
    const disabledTaskSyncGenerators = new Set(nxJson.sync?.disabledTaskSyncGenerators ?? []);
    for (const { data: { targets }, } of Object.values(projectGraph.nodes)) {
        if (!targets) {
            continue;
        }
        for (const target of Object.values(targets)) {
            if (!target.syncGenerators?.length) {
                continue;
            }
            for (const generator of target.syncGenerators) {
                if (!disabledTaskSyncGenerators.has(generator) &&
                    !taskSyncGenerators.has(generator)) {
                    taskSyncGenerators.add(generator);
                }
            }
        }
    }
    return taskSyncGenerators;
}
function collectEnabledTaskSyncGeneratorsFromTaskGraph(taskGraph, projectGraph, nxJson) {
    const taskSyncGenerators = new Set();
    const disabledTaskSyncGenerators = new Set(nxJson.sync?.disabledTaskSyncGenerators ?? []);
    for (const { target } of Object.values(taskGraph.tasks)) {
        const { syncGenerators } = projectGraph.nodes[target.project].data.targets[target.target];
        if (!syncGenerators?.length) {
            continue;
        }
        for (const generator of syncGenerators) {
            if (!disabledTaskSyncGenerators.has(generator) &&
                !taskSyncGenerators.has(generator)) {
                taskSyncGenerators.add(generator);
            }
        }
    }
    return taskSyncGenerators;
}
function collectRegisteredGlobalSyncGenerators(nxJson = (0, nx_json_1.readNxJson)()) {
    const globalSyncGenerators = new Set();
    if (!nxJson.sync?.globalGenerators?.length) {
        return globalSyncGenerators;
    }
    for (const generator of nxJson.sync.globalGenerators) {
        globalSyncGenerators.add(generator);
    }
    return globalSyncGenerators;
}
function getSyncGeneratorSuccessResultsMessageLines(results, logOutOfSyncDetails = false) {
    const messageLines = [];
    for (const result of results) {
        if ('error' in result) {
            continue;
        }
        messageLines.push(`[${pc.bold(result.generatorName)}]: ${result.outOfSyncMessage ?? `Some files are out of sync.`}`);
        if (logOutOfSyncDetails && result.outOfSyncDetails?.length) {
            messageLines.push(...result.outOfSyncDetails);
        }
    }
    return messageLines;
}
function getFailedSyncGeneratorsFixMessageLines(results, verbose, globalGeneratorSet = new Set()) {
    const messageLines = [];
    const globalGenerators = [];
    const taskGenerators = [];
    let isFirst = true;
    for (const result of results) {
        if ('error' in result) {
            if (!isFirst && verbose) {
                messageLines.push('');
            }
            isFirst = false;
            messageLines.push(`[${pc.bold(result.generatorName)}]: ${errorToString(result.error, verbose)}`);
            if (globalGeneratorSet.has(result.generatorName)) {
                globalGenerators.push(result.generatorName);
            }
            else {
                taskGenerators.push(result.generatorName);
            }
        }
    }
    messageLines.push(...getFailedSyncGeneratorsMessageLines(taskGenerators, globalGenerators, verbose));
    return messageLines;
}
function getFlushFailureMessageLines(result, verbose, globalGeneratorSet = new Set()) {
    const messageLines = [];
    const globalGenerators = [];
    const taskGenerators = [];
    let isFirst = true;
    for (const failure of result.generatorFailures) {
        if (!isFirst && verbose) {
            messageLines.push('');
        }
        isFirst = false;
        messageLines.push(`[${pc.bold(failure.generator)}]: ${errorToString(failure.error, verbose)}`);
        if (globalGeneratorSet.has(failure.generator)) {
            globalGenerators.push(failure.generator);
        }
        else {
            taskGenerators.push(failure.generator);
        }
    }
    messageLines.push(...getFailedSyncGeneratorsMessageLines(taskGenerators, globalGenerators, verbose));
    if (result.generalFailure) {
        if (messageLines.length > 0) {
            messageLines.push('');
            messageLines.push('Additionally, an unexpected error occurred:');
        }
        else {
            messageLines.push('An unexpected error occurred:');
        }
        messageLines.push(...[
            '',
            result.generalFailure.message,
            ...(!!result.generalFailure.stack
                ? [`\n${result.generalFailure.stack}`]
                : []),
            '',
            'Please report the error at: https://github.com/nrwl/nx/issues/new/choose',
        ]);
    }
    return messageLines;
}
function processSyncGeneratorResultErrors(results) {
    let failedGeneratorsCount = 0;
    for (const result of results) {
        if ('error' in result) {
            failedGeneratorsCount++;
        }
    }
    const areAllResultsFailures = failedGeneratorsCount === results.length;
    const anySyncGeneratorsFailed = failedGeneratorsCount > 0;
    return {
        failedGeneratorsCount,
        areAllResultsFailures,
        anySyncGeneratorsFailed,
    };
}
async function runSyncGenerators(generators) {
    const tree = new tree_1.FsTree(workspace_root_1.workspaceRoot, false, 'running sync generators');
    const projectGraph = await (0, project_graph_1.createProjectGraphAsync)();
    const { projects } = (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph);
    const results = [];
    for (const generator of generators) {
        const result = await runSyncGenerator(tree, generator, projects);
        results.push(result);
    }
    return results;
}
async function flushSyncGeneratorChangesToDisk(results) {
    perf_hooks_1.performance.mark('flush-sync-generator-changes-to-disk:start');
    const createdFiles = [];
    const updatedFiles = [];
    const deletedFiles = [];
    const generatorFailures = [];
    for (const result of results) {
        if ('error' in result) {
            continue;
        }
        for (const change of result.changes) {
            if (change.type === 'CREATE') {
                createdFiles.push(change.path);
            }
            else if (change.type === 'UPDATE') {
                updatedFiles.push(change.path);
            }
            else if (change.type === 'DELETE') {
                deletedFiles.push(change.path);
            }
        }
        try {
            // Write changes to disk
            (0, tree_1.flushChanges)(workspace_root_1.workspaceRoot, result.changes);
            // Run the callback
            if (result.callback) {
                await result.callback();
            }
        }
        catch (e) {
            generatorFailures.push({
                generator: result.generatorName,
                error: toSerializableError(e),
            });
        }
    }
    try {
        // Update the context files
        await (0, workspace_context_1.updateContextWithChangedFiles)(workspace_root_1.workspaceRoot, createdFiles, updatedFiles, deletedFiles);
        perf_hooks_1.performance.mark('flush-sync-generator-changes-to-disk:end');
        perf_hooks_1.performance.measure('flush sync generator changes to disk', 'flush-sync-generator-changes-to-disk:start', 'flush-sync-generator-changes-to-disk:end');
    }
    catch (e) {
        return {
            generatorFailures,
            generalFailure: toSerializableError(e),
        };
    }
    return generatorFailures.length > 0
        ? { generatorFailures }
        : { success: true };
}
function getFailedSyncGeneratorsMessageLines(taskGenerators, globalGenerators, verbose) {
    const messageLines = [];
    if (taskGenerators.length + globalGenerators.length === 1) {
        messageLines.push('', verbose
            ? 'Please check the error above and address the issue.'
            : 'Please check the error above and address the issue. You can provide the `--verbose` flag to get more details.');
        if (taskGenerators.length === 1) {
            messageLines.push(`If needed, you can disable the failing sync generator by setting \`sync.disabledTaskSyncGenerators: ["${taskGenerators[0]}"]\` in your \`nx.json\`.`);
        }
        else {
            messageLines.push(`If needed, you can remove the failing global sync generator "${globalGenerators[0]}" from the \`sync.globalGenerators\` array in your \`nx.json\`.`);
        }
    }
    else if (taskGenerators.length + globalGenerators.length > 1) {
        messageLines.push('', verbose
            ? 'Please check the errors above and address the issues.'
            : 'Please check the errors above and address the issues. You can provide the `--verbose` flag to get more details.');
        if (taskGenerators.length > 0) {
            const generatorsString = taskGenerators.map((g) => `"${g}"`).join(', ');
            messageLines.push(`If needed, you can disable the failing task sync generators by setting \`sync.disabledTaskSyncGenerators: [${generatorsString}]\` in your \`nx.json\`.`);
        }
        if (globalGenerators.length > 0) {
            const lastGenerator = globalGenerators.pop();
            const generatorsString = globalGenerators.length > 0
                ? `${globalGenerators
                    .map((g) => `"${g}"`)
                    .join(', ')} and "${lastGenerator}"`
                : `"${lastGenerator}"`;
            messageLines.push(`If needed, you can remove the failing global sync generators ${generatorsString} from the \`sync.globalGenerators\` array in your \`nx.json\`.`);
        }
    }
    return messageLines;
}
function errorToString(error, verbose) {
    if (error.title) {
        let message = `${pc.red(error.title)}`;
        if (error.bodyLines?.length) {
            message += `

  ${error.bodyLines
                .map((bodyLine) => `${bodyLine.split('\n').join('\n  ')}`)
                .join('\n  ')}`;
            return message;
        }
    }
    return `${pc.red(error.message)}${verbose && error.stack ? '\n  ' + error.stack : ''}`;
}
function toSerializableError(error) {
    return error instanceof SyncError
        ? {
            title: error.title,
            bodyLines: error.bodyLines,
            message: error.message,
            stack: error.stack,
        }
        : { message: error.message, stack: error.stack };
}
