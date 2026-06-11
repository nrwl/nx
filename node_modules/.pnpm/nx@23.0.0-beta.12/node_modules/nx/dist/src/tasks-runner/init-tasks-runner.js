"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTasksRunner = initTasksRunner;
exports.runDiscreteTasks = runDiscreteTasks;
exports.runContinuousTasks = runContinuousTasks;
const nx_json_1 = require("../config/nx-json");
const project_graph_1 = require("../project-graph/project-graph");
const run_command_1 = require("./run-command");
const invoke_runner_terminal_output_life_cycle_1 = require("./life-cycles/invoke-runner-terminal-output-life-cycle");
const perf_hooks_1 = require("perf_hooks");
const utils_1 = require("./utils");
const dotenv_1 = require("../utils/dotenv");
const life_cycle_1 = require("./life-cycle");
const task_orchestrator_1 = require("./task-orchestrator");
const create_task_hasher_1 = require("../hasher/create-task-hasher");
const client_1 = require("../daemon/client/client");
const task_results_life_cycle_1 = require("./life-cycles/task-results-life-cycle");
/**
 * This function is deprecated. Do not use this
 * @deprecated This function is deprecated. Do not use this
 */
async function initTasksRunner(nxArgs) {
    perf_hooks_1.performance.mark('init-local');
    (0, dotenv_1.loadRootEnvFiles)();
    const nxJson = (0, nx_json_1.readNxJson)();
    if (nxArgs.verbose) {
        process.env.NX_VERBOSE_LOGGING = 'true';
    }
    const projectGraph = await (0, project_graph_1.createProjectGraphAsync)({ exitOnError: true });
    return {
        invoke: async (opts) => {
            perf_hooks_1.performance.mark('code-loading:end');
            // TODO: This polyfills the outputs if someone doesn't pass a task with outputs. Remove this in Nx 20
            opts.tasks.forEach((t) => {
                if (!t.outputs) {
                    t.outputs = (0, utils_1.getOutputs)(projectGraph.nodes, t.target, t.overrides);
                }
            });
            const lifeCycle = new invoke_runner_terminal_output_life_cycle_1.InvokeRunnerTerminalOutputLifeCycle(opts.tasks);
            const taskGraph = {
                roots: opts.tasks.map((task) => task.id),
                tasks: opts.tasks.reduce((acc, task) => {
                    acc[task.id] = task;
                    return acc;
                }, {}),
                dependencies: opts.tasks.reduce((acc, task) => {
                    acc[task.id] = [];
                    return acc;
                }, {}),
                continuousDependencies: opts.tasks.reduce((acc, task) => {
                    acc[task.id] = [];
                    return acc;
                }, {}),
            };
            const taskResults = await (0, run_command_1.invokeTasksRunner)({
                tasks: opts.tasks,
                projectGraph,
                taskGraph,
                lifeCycle,
                nxJson,
                nxArgs: { ...nxArgs, parallel: opts.parallel },
                loadDotEnvFiles: true,
                initiatingProject: null,
                initiatingTasks: [],
            });
            return {
                status: Object.values(taskResults).some((taskResult) => taskResult.status === 'failure' || taskResult.status === 'skipped')
                    ? 1
                    : 0,
                taskGraph,
                taskResults,
            };
        },
    };
}
async function createOrchestrator(tasks, projectGraph, taskGraphForHashing, nxJson, lifeCycle) {
    (0, dotenv_1.loadRootEnvFiles)();
    const invokeRunnerTerminalLifecycle = new invoke_runner_terminal_output_life_cycle_1.InvokeRunnerTerminalOutputLifeCycle(tasks);
    const taskResultsLifecycle = new task_results_life_cycle_1.TaskResultsLifeCycle();
    const compositedLifeCycle = new life_cycle_1.CompositeLifeCycle([
        ...(0, run_command_1.constructLifeCycles)(invokeRunnerTerminalLifecycle),
        taskResultsLifecycle,
        lifeCycle,
    ]);
    const { runnerOptions: options } = (0, run_command_1.getRunner)({}, nxJson);
    let hasher = (0, create_task_hasher_1.createTaskHasher)(projectGraph, nxJson, options);
    const taskGraph = {
        roots: tasks.map((task) => task.id),
        tasks: tasks.reduce((acc, task) => {
            acc[task.id] = task;
            return acc;
        }, {}),
        dependencies: tasks.reduce((acc, task) => {
            acc[task.id] = [];
            return acc;
        }, {}),
        continuousDependencies: tasks.reduce((acc, task) => {
            acc[task.id] = [];
            return acc;
        }, {}),
    };
    const nxArgs = {
        ...options,
        parallel: tasks.length,
        lifeCycle: compositedLifeCycle,
    };
    (0, run_command_1.setEnvVarsBasedOnArgs)(nxArgs, true);
    const orchestrator = new task_orchestrator_1.TaskOrchestrator(hasher, null, tasks, projectGraph, taskGraph, nxJson, nxArgs, false, client_1.daemonClient, undefined, taskGraphForHashing);
    await orchestrator.init();
    orchestrator.processAllScheduledTasks();
    return orchestrator;
}
async function runDiscreteTasks(tasks, projectGraph, taskGraphForHashing, nxJson, lifeCycle) {
    const orchestrator = await createOrchestrator(tasks, projectGraph, taskGraphForHashing, nxJson, lifeCycle);
    let groupId = 0;
    let nextBatch = orchestrator.nextBatch();
    const batchResults = [];
    /**
     * Set of task ids that were part of batches
     */
    const batchTasks = new Set();
    while (nextBatch) {
        for (const task in nextBatch.taskGraph.tasks) {
            batchTasks.add(task);
        }
        batchResults.push(orchestrator.applyFromCacheOrRunBatch(true, nextBatch, groupId++));
        nextBatch = orchestrator.nextBatch();
    }
    const discreteTasks = tasks.filter((task) => !batchTasks.has(task.id));
    // Bulk-resolve every discrete task's cache state in one shot —
    // single SQL call plus parallel remote retrievals. Batches kicked
    // off above continue running concurrently while we await this.
    const cacheHits = await orchestrator.resolveCachedTasks(true, discreteTasks, groupId++);
    const cacheHitsById = new Map(cacheHits.map((h) => [h.task.id, h]));
    const taskResults = discreteTasks.map(async (task) => {
        const hit = cacheHitsById.get(task.id);
        if (hit)
            return [hit];
        return [await orchestrator.runTaskDirectly(true, task, groupId++)];
    });
    return [...batchResults, ...taskResults];
}
async function runContinuousTasks(tasks, projectGraph, taskGraphForHashing, nxJson, lifeCycle) {
    const orchestrator = await createOrchestrator(tasks, projectGraph, taskGraphForHashing, nxJson, lifeCycle);
    return tasks.reduce((current, task, index) => {
        current[task.id] = orchestrator.startContinuousTask(task, index);
        return current;
    }, {});
}
