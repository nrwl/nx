"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommandGraph = createCommandGraph;
const task_graph_utils_1 = require("../tasks-runner/task-graph-utils");
const output_1 = require("../utils/output");
/**
 * Make structure { lib: [dep], dep: [dep1], dep1: [] } from projectName lib and projectGraph
 * @param projectGraph
 * @param projectName
 * @param resolved reference to an object that will contain resolved dependencies
 * @returns
 */
const recursiveResolveDeps = (projectGraph, projectName, resolved) => {
    if (projectGraph.dependencies[projectName].length === 0) {
        // no deps - no resolve
        resolved[projectName] = [];
        return;
    }
    // if already resolved - just skip
    if (resolved[projectName]) {
        return resolved[projectName];
    }
    // deps string list
    const projectDeps = [
        ...new Set(projectGraph.dependencies[projectName]
            .map((projectDep) => projectDep.target)
            .filter((projectDep) => projectGraph.nodes[projectDep])).values(),
    ];
    // define
    resolved[projectName] = projectDeps;
    if (projectDeps.length > 0) {
        for (const dep of projectDeps) {
            recursiveResolveDeps(projectGraph, dep, resolved);
        }
    }
};
function createCommandGraph(projectGraph, projectNames, nxArgs) {
    const dependencies = {};
    if (!nxArgs.excludeTaskDependencies) {
        for (const projectName of projectNames) {
            recursiveResolveDeps(projectGraph, projectName, dependencies);
        }
    }
    const roots = Object.keys(dependencies).filter((d) => dependencies[d].length === 0);
    const commandGraph = {
        dependencies,
        roots,
    };
    const cycle = (0, task_graph_utils_1.findCycle)(commandGraph);
    if (cycle) {
        if (process.env.NX_IGNORE_CYCLES === 'true' || nxArgs.nxIgnoreCycles) {
            output_1.output.warn({
                title: `The command graph has a circular dependency`,
                bodyLines: [`${cycle.join(' --> ')}`],
            });
            (0, task_graph_utils_1.makeAcyclic)(commandGraph);
        }
        else {
            output_1.output.error({
                title: `Could not execute command because the project graph has a circular dependency`,
                bodyLines: [`${cycle.join(' --> ')}`],
            });
            process.exit(1);
        }
    }
    return commandGraph;
}
