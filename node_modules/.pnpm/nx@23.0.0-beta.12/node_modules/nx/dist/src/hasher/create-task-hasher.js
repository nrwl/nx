"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTaskHasher = createTaskHasher;
const client_1 = require("../daemon/client/client");
const build_project_graph_1 = require("../project-graph/build-project-graph");
const task_hasher_1 = require("./task-hasher");
function createTaskHasher(projectGraph, nxJson, runnerOptions) {
    if (client_1.daemonClient.enabled()) {
        return new task_hasher_1.DaemonBasedTaskHasher(client_1.daemonClient, runnerOptions);
    }
    else {
        const { rustReferences } = (0, build_project_graph_1.getFileMap)();
        return new task_hasher_1.InProcessTaskHasher(projectGraph, nxJson, rustReferences, runnerOptions);
    }
}
