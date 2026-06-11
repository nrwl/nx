"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHashTasks = handleHashTasks;
const project_graph_incremental_recomputation_1 = require("./project-graph-incremental-recomputation");
const task_hasher_1 = require("../../hasher/task-hasher");
const configuration_1 = require("../../config/configuration");
/**
 * We use this not to recreated hasher for every hash operation
 * TaskHasher has a cache inside, so keeping it around results in faster performance
 */
let storedProjectGraph = null;
let storedHasher = null;
async function handleHashTasks(payload) {
    const { error, projectGraph, rustReferences } = await (0, project_graph_incremental_recomputation_1.getCachedSerializedProjectGraphPromise)();
    if (error) {
        throw error;
    }
    const nxJson = (0, configuration_1.readNxJson)();
    if (projectGraph !== storedProjectGraph) {
        storedProjectGraph = projectGraph;
        storedHasher = new task_hasher_1.InProcessTaskHasher(projectGraph, nxJson, rustReferences, payload.runnerOptions);
    }
    const response = await storedHasher.hashTasks(payload.tasks, payload.taskGraph, payload.perTaskEnvs, payload.cwd, payload.collectInputs);
    return {
        response,
        description: 'handleHashTasks',
    };
}
