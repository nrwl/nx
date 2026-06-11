"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTaskDetails = getTaskDetails;
exports.hashTasksThatDoNotDependOnOutputsOfOtherTasks = hashTasksThatDoNotDependOnOutputsOfOtherTasks;
exports.hashTask = hashTask;
exports.hashTasks = hashTasks;
const nx_json_1 = require("../config/nx-json");
const native_1 = require("../native");
const project_graph_1 = require("../project-graph/project-graph");
const task_io_service_1 = require("../tasks-runner/task-io-service");
const task_env_1 = require("../tasks-runner/task-env");
const utils_1 = require("../tasks-runner/utils");
const db_connection_1 = require("../utils/db-connection");
const task_hasher_1 = require("./task-hasher");
let taskDetails;
function getTaskDetails() {
    // TODO: Remove when wasm supports sqlite
    if (native_1.IS_WASM) {
        return null;
    }
    if (!taskDetails) {
        taskDetails = new native_1.TaskDetails((0, db_connection_1.getDbConnection)());
    }
    return taskDetails;
}
async function hashTasksThatDoNotDependOnOutputsOfOtherTasks(hasher, projectGraph, taskGraph, nxJson, tasksDetails) {
    performance.mark('hashMultipleTasks:start');
    const projects = (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph).projects;
    const tasks = Object.values(taskGraph.tasks);
    const tasksWithHashers = await Promise.all(tasks.map(async (task) => {
        const customHasher = (0, utils_1.getCustomHasher)(task, projects);
        return { task, customHasher };
    }));
    const tasksToHash = tasksWithHashers
        .filter(({ task, customHasher }) => {
        // If a task has a custom hasher, it might depend on the outputs of other tasks
        if (customHasher) {
            return false;
        }
        return !(taskGraph.dependencies[task.id].length > 0 &&
            (0, task_hasher_1.getInputs)(task, projectGraph, nxJson).depsOutputs.length > 0);
    })
        .map((t) => t.task);
    const perTaskEnvs = {};
    for (const task of tasksToHash) {
        perTaskEnvs[task.id] = (0, task_env_1.getTaskSpecificEnv)(task, projectGraph);
    }
    const hashes = await hasher.hashTasks(tasksToHash, taskGraph, perTaskEnvs);
    const ioService = (0, task_io_service_1.getTaskIOService)();
    const hasInputSubscribers = ioService.hasTaskInputSubscribers();
    for (let i = 0; i < tasksToHash.length; i++) {
        tasksToHash[i].hash = hashes[i].value;
        tasksToHash[i].hashDetails = hashes[i].details;
        // Notify TaskIOService of hash inputs
        if (hasInputSubscribers && hashes[i].inputs) {
            ioService.notifyTaskInputs(tasksToHash[i].id, hashes[i].inputs);
        }
    }
    if (tasksDetails?.recordTaskDetails) {
        tasksDetails.recordTaskDetails(tasksToHash.map((task) => ({
            hash: task.hash,
            project: task.target.project,
            target: task.target.target,
            configuration: task.target.configuration,
        })));
    }
    performance.mark('hashMultipleTasks:end');
    performance.measure('hashMultipleTasks', 'hashMultipleTasks:start', 'hashMultipleTasks:end');
}
async function hashTask(hasher, projectGraph, taskGraph, task, env, taskDetails) {
    performance.mark('hashSingleTask:start');
    const projectsConfigurations = (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph);
    const customHasher = (0, utils_1.getCustomHasher)(task, projectsConfigurations.projects);
    const { value, details, inputs } = await (customHasher
        ? customHasher(task, {
            hasher,
            projectGraph,
            taskGraph,
            workspaceConfig: projectsConfigurations, // to make the change non-breaking. Remove after v19
            projectsConfigurations,
            nxJsonConfiguration: (0, nx_json_1.readNxJson)(),
            env,
        })
        : hasher.hashTask(task, taskGraph, env));
    task.hash = value;
    task.hashDetails = details;
    // Notify TaskIOService of hash inputs
    const ioService = (0, task_io_service_1.getTaskIOService)();
    if (ioService.hasTaskInputSubscribers() && inputs) {
        ioService.notifyTaskInputs(task.id, inputs);
    }
    if (taskDetails?.recordTaskDetails) {
        taskDetails.recordTaskDetails([
            {
                hash: task.hash,
                project: task.target.project,
                target: task.target.target,
                configuration: task.target.configuration,
            },
        ]);
    }
    performance.mark('hashSingleTask:end');
    performance.measure('hashSingleTask', 'hashSingleTask:start', 'hashSingleTask:end');
}
/**
 * Batch-hash `tasks`. `perTaskEnvs` must contain an entry keyed by
 * `task.id` for every task — the per-task env is what each task's
 * custom hasher sees and what the built-in hasher reads
 * `HashInstruction::Environment` inputs against. Callers that
 * genuinely want to hash against a single shared env should build
 * `{ [task.id]: env }` for every task.
 */
async function hashTasks(hasher, projectGraph, taskGraph, perTaskEnvs, taskDetails, tasksToHashOverride) {
    performance.mark('hashMultipleTasks:start');
    const projectsConfigurations = (0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph);
    const nxJson = (0, nx_json_1.readNxJson)();
    const tasks = (tasksToHashOverride ?? Object.values(taskGraph.tasks)).filter((task) => !task.hash);
    // Separate tasks with custom hashers from those without
    const tasksWithCustomHashers = [];
    const tasksWithoutCustomHashers = [];
    for (const task of tasks) {
        const customHasher = (0, utils_1.getCustomHasher)(task, projectsConfigurations.projects);
        if (customHasher) {
            tasksWithCustomHashers.push(task);
        }
        else {
            tasksWithoutCustomHashers.push(task);
        }
    }
    // Hash tasks with custom hashers individually
    const ioService = (0, task_io_service_1.getTaskIOService)();
    const hasInputSubscribers = ioService.hasTaskInputSubscribers();
    const customHasherPromises = tasksWithCustomHashers.map(async (task) => {
        const customHasher = (0, utils_1.getCustomHasher)(task, projectsConfigurations.projects);
        const { value, details, inputs } = await customHasher(task, {
            hasher,
            projectGraph,
            taskGraph,
            workspaceConfig: projectsConfigurations,
            projectsConfigurations,
            nxJsonConfiguration: nxJson,
            env: perTaskEnvs[task.id],
        });
        task.hash = value;
        task.hashDetails = details;
        // Notify TaskIOService of hash inputs
        if (hasInputSubscribers && inputs) {
            ioService.notifyTaskInputs(task.id, inputs);
        }
    });
    // Hash tasks without custom hashers in batch
    let batchHashPromise = Promise.resolve();
    if (tasksWithoutCustomHashers.length > 0) {
        batchHashPromise = hasher
            .hashTasks(tasksWithoutCustomHashers, taskGraph, perTaskEnvs)
            .then((hashes) => {
            for (let i = 0; i < tasksWithoutCustomHashers.length; i++) {
                tasksWithoutCustomHashers[i].hash = hashes[i].value;
                tasksWithoutCustomHashers[i].hashDetails = hashes[i].details;
                // Notify TaskIOService of hash inputs
                if (hasInputSubscribers && hashes[i].inputs) {
                    ioService.notifyTaskInputs(tasksWithoutCustomHashers[i].id, hashes[i].inputs);
                }
            }
        });
    }
    await Promise.all([...customHasherPromises, batchHashPromise]);
    if (taskDetails?.recordTaskDetails) {
        // Guard against a custom hasher resolving with a falsy value —
        // the built-in batch hasher always produces a hash, but user-written
        // custom hashers are untrusted and an empty/undefined hash would
        // violate the task_details schema downstream.
        const hashedTasks = [];
        for (const t of tasks) {
            if (!t.hash) {
                continue;
            }
            hashedTasks.push({
                hash: t.hash,
                project: t.target.project,
                target: t.target.target,
                configuration: t.target.configuration,
            });
        }
        if (hashedTasks.length > 0) {
            taskDetails.recordTaskDetails(hashedTasks);
        }
    }
    performance.mark('hashMultipleTasks:end');
    performance.measure('hashMultipleTasks', 'hashMultipleTasks:start', 'hashMultipleTasks:end');
}
