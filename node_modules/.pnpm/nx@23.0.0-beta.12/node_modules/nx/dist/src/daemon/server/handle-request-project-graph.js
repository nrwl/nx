"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRequestProjectGraph = handleRequestProjectGraph;
const perf_hooks_1 = require("perf_hooks");
const socket_utils_1 = require("../socket-utils");
const logger_1 = require("../logger");
const project_graph_incremental_recomputation_1 = require("./project-graph-incremental-recomputation");
async function handleRequestProjectGraph(socket) {
    try {
        perf_hooks_1.performance.mark('server-connection');
        logger_1.serverLogger.requestLog('Client Request for Project Graph Received');
        const result = await (0, project_graph_incremental_recomputation_1.getCachedSerializedProjectGraphPromise)(socket);
        if (result.error) {
            return {
                description: `Error when preparing serialized project graph.`,
                error: result.error,
            };
        }
        const serializedResult = (0, socket_utils_1.serializeResult)(result.error, result.serializedProjectGraph, result.serializedSourceMaps);
        if (!serializedResult) {
            return {
                description: `Error when serializing project graph result.`,
                error: new Error('Critical error when serializing server result, check server logs'),
            };
        }
        perf_hooks_1.performance.mark('serialized-project-graph-ready');
        perf_hooks_1.performance.measure('total for creating and serializing project graph', 'server-connection', 'serialized-project-graph-ready');
        return { response: serializedResult, description: 'project-graph' };
    }
    catch (e) {
        return {
            description: `Unexpected error when creating Project Graph.`,
            error: e,
        };
    }
}
