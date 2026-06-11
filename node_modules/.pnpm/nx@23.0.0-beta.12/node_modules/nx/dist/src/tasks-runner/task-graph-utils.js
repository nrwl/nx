"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCycle = findCycle;
exports.findCycles = findCycles;
exports.makeAcyclic = makeAcyclic;
exports.validateNoAtomizedTasks = validateNoAtomizedTasks;
exports.assertTaskGraphDoesNotContainInvalidTargets = assertTaskGraphDoesNotContainInvalidTargets;
exports.getLeafTasks = getLeafTasks;
exports.walkTaskGraph = walkTaskGraph;
const output_1 = require("../utils/output");
function _findCycle(graph, id, visited, path) {
    if (visited[id])
        return null;
    visited[id] = true;
    for (const d of [
        ...graph.dependencies[id],
        ...(graph.continuousDependencies?.[id] ?? []),
    ]) {
        if (path.includes(d))
            return [...path, d];
        const cycle = _findCycle(graph, d, visited, [...path, d]);
        if (cycle)
            return cycle;
    }
    return null;
}
/**
 * This function finds a cycle in the graph.
 * @returns the first cycle found, or null if no cycle is found.
 */
function findCycle(graph) {
    const visited = {};
    for (const t of Object.keys(graph.dependencies)) {
        visited[t] = false;
    }
    for (const t of Object.keys(graph.dependencies)) {
        const cycle = _findCycle(graph, t, visited, [t]);
        if (cycle)
            return cycle;
    }
    return null;
}
/**
 * This function finds all cycles in the graph.
 * @returns a list of unique task ids in all cycles found, or null if no cycle is found.
 */
function findCycles(graph) {
    const visited = {};
    const cycles = new Set();
    for (const t of Object.keys(graph.dependencies)) {
        visited[t] = false;
    }
    for (const t of Object.keys(graph.dependencies)) {
        const cycle = _findCycle(graph, t, visited, [t]);
        if (cycle) {
            cycle.forEach((t) => cycles.add(t));
        }
    }
    return cycles.size ? cycles : null;
}
function _makeAcyclic(graph, id, visited, path) {
    if (visited[id])
        return;
    visited[id] = true;
    const deps = graph.dependencies[id];
    const continuousDeps = graph.continuousDependencies?.[id] ?? [];
    for (const d of [...deps, ...continuousDeps]) {
        if (path.includes(d)) {
            const depsIdx = deps.indexOf(d);
            if (depsIdx >= 0) {
                deps.splice(depsIdx, 1);
            }
            const continuousIdx = continuousDeps.indexOf(d);
            if (continuousIdx >= 0) {
                continuousDeps.splice(continuousIdx, 1);
            }
        }
        else {
            _makeAcyclic(graph, d, visited, [...path, d]);
        }
    }
    return null;
}
function makeAcyclic(graph) {
    const visited = {};
    for (const t of Object.keys(graph.dependencies)) {
        visited[t] = false;
    }
    for (const t of Object.keys(graph.dependencies)) {
        _makeAcyclic(graph, t, visited, [t]);
    }
    graph.roots = Object.keys(graph.dependencies).filter((t) => graph.dependencies[t].length === 0);
}
function validateNoAtomizedTasks(taskGraph, projectGraph) {
    const getNonAtomizedTargetForTask = (task) => projectGraph.nodes[task.target.project]?.data?.targets?.[task.target.target]
        ?.metadata?.nonAtomizedTarget;
    const atomizedRootTasks = Object.values(taskGraph.tasks).filter((task) => getNonAtomizedTargetForTask(task) !== undefined);
    if (atomizedRootTasks.length === 0) {
        return;
    }
    const nonAtomizedTasks = atomizedRootTasks
        .map((t) => `"${getNonAtomizedTargetForTask(t)}"`)
        .filter((item, index, arr) => arr.indexOf(item) === index);
    const moreInfoLines = [
        `Please enable Nx Cloud or use the slower ${nonAtomizedTasks.join(',')} task${nonAtomizedTasks.length > 1 ? 's' : ''}.`,
        'Learn more at https://nx.dev/ci/features/split-e2e-tasks#nx-cloud-is-required-to-run-atomized-tasks',
    ];
    if (atomizedRootTasks.length === 1) {
        output_1.output.error({
            title: `The ${atomizedRootTasks[0].id} task should only be run with Nx Cloud.`,
            bodyLines: [...moreInfoLines],
        });
    }
    else {
        output_1.output.error({
            title: `The following tasks should only be run with Nx Cloud:`,
            bodyLines: [
                ...atomizedRootTasks.map((task) => `  - ${task.id}`),
                '',
                ...moreInfoLines,
            ],
        });
    }
    process.exit(1);
}
function assertTaskGraphDoesNotContainInvalidTargets(taskGraph) {
    const nonParallelTasksThatDependOnContinuousTasks = [];
    const nonParallelContinuousTasksThatAreDependedOn = [];
    for (const task of Object.values(taskGraph.tasks)) {
        if (task.parallelism === false &&
            taskGraph.continuousDependencies[task.id].length > 0) {
            nonParallelTasksThatDependOnContinuousTasks.push(task);
        }
        for (const dependency of taskGraph.continuousDependencies[task.id]) {
            if (taskGraph.tasks[dependency].parallelism === false) {
                nonParallelContinuousTasksThatAreDependedOn.push(taskGraph.tasks[dependency]);
            }
        }
    }
    if (nonParallelTasksThatDependOnContinuousTasks.length > 0) {
        throw new NonParallelTaskDependsOnContinuousTasksError(nonParallelTasksThatDependOnContinuousTasks, taskGraph);
    }
    if (nonParallelContinuousTasksThatAreDependedOn.length > 0) {
        throw new DependingOnNonParallelContinuousTaskError(nonParallelContinuousTasksThatAreDependedOn, taskGraph);
    }
}
class NonParallelTaskDependsOnContinuousTasksError extends Error {
    constructor(invalidTasks, taskGraph) {
        let message = 'The following tasks do not support parallelism but depend on continuous tasks:';
        for (const task of invalidTasks) {
            message += `\n - ${task.id} -> ${taskGraph.continuousDependencies[task.id].join(', ')}`;
        }
        super(message);
        this.invalidTasks = invalidTasks;
        this.name = 'NonParallelTaskDependsOnContinuousTasksError';
    }
}
class DependingOnNonParallelContinuousTaskError extends Error {
    constructor(invalidTasks, taskGraph) {
        let message = 'The following continuous tasks do not support parallelism but are depended on:';
        for (const task of invalidTasks) {
            const dependents = Object.keys(taskGraph.continuousDependencies).filter((parentTaskId) => taskGraph.continuousDependencies[parentTaskId].includes(task.id));
            message += `\n - ${task.id} <- ${dependents.join(', ')}`;
        }
        message +=
            '\nParallelism must be enabled for a continuous task if it is depended on, as the tasks that depend on it will run in parallel with it.';
        super(message);
        this.invalidTasks = invalidTasks;
        this.name = 'DependingOnNonParallelContinuousTaskError';
    }
}
function getLeafTasks(taskGraph) {
    const reversed = reverseTaskGraph(taskGraph);
    const leafTasks = new Set();
    for (const [taskId, dependencies] of Object.entries(reversed.dependencies)) {
        if (dependencies.length === 0) {
            leafTasks.add(taskId);
        }
    }
    return leafTasks;
}
function reverseTaskGraph(taskGraph) {
    const reversed = {
        tasks: taskGraph.tasks,
        dependencies: Object.fromEntries(Object.entries(taskGraph.tasks).map(([taskId]) => [taskId, []])),
    };
    for (const [taskId, dependencies] of Object.entries(taskGraph.dependencies)) {
        for (const dependency of dependencies) {
            reversed.dependencies[dependency].push(taskId);
        }
    }
    for (const [taskId, dependencies] of Object.entries(taskGraph.continuousDependencies)) {
        for (const dependency of dependencies) {
            reversed.dependencies[dependency].push(taskId);
        }
    }
    return reversed;
}
/**
 * Walk a task graph topologically, calling walkFn for each wave of roots.
 * Considers both dependencies and continuousDependencies.
 */
async function walkTaskGraph(taskGraph, walkFn) {
    const reversed = reverseTaskGraph(taskGraph);
    const inDegree = {};
    for (const id of Object.keys(taskGraph.tasks)) {
        inDegree[id] =
            (taskGraph.dependencies[id]?.length ?? 0) +
                (taskGraph.continuousDependencies?.[id]?.length ?? 0);
    }
    let currentRoots = taskGraph.roots.slice();
    while (currentRoots.length > 0) {
        await walkFn(currentRoots);
        const nextRoots = [];
        for (const id of currentRoots) {
            for (const depId of reversed.dependencies[id] ?? []) {
                inDegree[depId]--;
                if (inDegree[depId] === 0) {
                    nextRoots.push(depId);
                }
            }
        }
        currentRoots = nextRoots;
    }
}
