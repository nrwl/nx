"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pruneExternalNodes = void 0;
exports.reverse = reverse;
exports.filterNodes = filterNodes;
exports.isNpmProject = isNpmProject;
exports.withDeps = withDeps;
const reverseMemo = new Map();
/**
 * Returns a new project graph where all the edges are reversed.
 *
 * For instance, if project A depends on B, in the reversed graph
 * B will depend on A.
 */
function reverse(graph) {
    const resultFromMemo = reverseMemo.get(graph);
    if (resultFromMemo) {
        return resultFromMemo;
    }
    const result = {
        ...graph,
        nodes: { ...graph.nodes },
        externalNodes: { ...graph.externalNodes },
        dependencies: {},
    };
    Object.keys(graph.nodes).forEach((n) => (result.dependencies[n] = []));
    // we need to keep external node's reverse dependencies to trace our route back
    if (graph.externalNodes) {
        Object.keys(graph.externalNodes).forEach((n) => (result.dependencies[n] = []));
    }
    Object.values(graph.dependencies).forEach((byProject) => {
        byProject.forEach((dep) => {
            const dependency = result.dependencies[dep.target];
            if (dependency) {
                dependency.push({
                    type: dep.type,
                    source: dep.target,
                    target: dep.source,
                });
            }
        });
    });
    reverseMemo.set(graph, result);
    reverseMemo.set(result, graph);
    return result;
}
function filterNodes(predicate) {
    return (original) => {
        const graph = { nodes: {}, dependencies: {} };
        const added = new Set();
        Object.values(original.nodes).forEach((n) => {
            if (!predicate || predicate(n)) {
                graph.nodes[n.name] = n;
                graph.dependencies[n.name] = [];
                added.add(n.name);
            }
        });
        Object.values(original.dependencies).forEach((ds) => {
            ds.forEach((d) => {
                if (added.has(d.source) && added.has(d.target)) {
                    graph.dependencies[d.source].push(d);
                }
            });
        });
        return graph;
    };
}
function isNpmProject(project) {
    return project?.type === 'npm';
}
exports.pruneExternalNodes = filterNodes();
function withDeps(original, subsetNodes) {
    const res = { nodes: {}, dependencies: {} };
    const visitedNodes = [];
    const visitedEdges = [];
    Object.values(subsetNodes).forEach(recurNodes);
    Object.values(subsetNodes).forEach(recurEdges);
    return res;
    // ---------------------------------------------------------------------------
    function recurNodes(node) {
        if (visitedNodes.indexOf(node.name) > -1)
            return;
        res.nodes[node.name] = node;
        if (!res.dependencies[node.name]) {
            res.dependencies[node.name] = [];
        }
        visitedNodes.push(node.name);
        original.dependencies[node.name].forEach((n) => {
            if (original.nodes[n.target]) {
                recurNodes(original.nodes[n.target]);
            }
        });
    }
    function recurEdges(node) {
        if (visitedEdges.indexOf(node.name) > -1)
            return;
        visitedEdges.push(node.name);
        const ds = original.dependencies[node.name];
        ds.forEach((n) => {
            if (!original.nodes[n.target]) {
                return;
            }
            if (!res.dependencies[n.source]) {
                res.dependencies[n.source] = [];
            }
            res.dependencies[n.source].push(n);
        });
        ds.forEach((n) => {
            if (original.nodes[n.target]) {
                recurEdges(original.nodes[n.target]);
            }
        });
    }
}
