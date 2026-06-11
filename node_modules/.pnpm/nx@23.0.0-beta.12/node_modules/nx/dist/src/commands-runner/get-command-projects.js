"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCommandProjects = getCommandProjects;
const create_command_graph_1 = require("./create-command-graph");
function getCommandProjects(projectGraph, projects, nxArgs) {
    const commandGraph = (0, create_command_graph_1.createCommandGraph)(projectGraph, projects.map((project) => project.name), nxArgs);
    return getSortedProjects(commandGraph);
}
function getSortedProjects(commandGraph, sortedProjects = []) {
    const roots = commandGraph.roots;
    if (!roots.length) {
        return sortedProjects;
    }
    sortedProjects.push(...roots);
    const newGraph = removeIdsFromGraph(commandGraph, roots, commandGraph.dependencies);
    return getSortedProjects(newGraph, sortedProjects);
}
function removeIdsFromGraph(graph, ids, mapWithIds) {
    const filteredMapWithIds = {};
    const dependencies = {};
    const removedSet = new Set(ids);
    for (let id of Object.keys(mapWithIds)) {
        if (!removedSet.has(id)) {
            filteredMapWithIds[id] = mapWithIds[id];
            dependencies[id] = graph.dependencies[id].filter((depId) => !removedSet.has(depId));
        }
    }
    return {
        mapWithIds: filteredMapWithIds,
        dependencies: dependencies,
        roots: Object.keys(dependencies).filter((k) => dependencies[k].length === 0),
    };
}
