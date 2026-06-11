"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.topologicalSort = topologicalSort;
/**
 * Topologically sorts a directed graph, returning the sorted nodes.
 * Handles cycles by breaking them where needed.
 *
 * @param nodes All nodes in the graph
 * @param getEdges Function that returns outgoing edges for a node
 * @returns Topologically sorted list of nodes
 */
function topologicalSort(nodes, getEdges) {
    const result = [];
    const visited = new Set();
    const temp = new Set();
    function visit(node) {
        // Node is already in result
        if (visited.has(node)) {
            return;
        }
        // Cycle detected, skip this edge to break the cycle
        if (temp.has(node)) {
            return;
        }
        temp.add(node);
        // Visit all dependencies first
        for (const dep of getEdges(node)) {
            visit(dep);
        }
        temp.delete(node);
        visited.add(node);
        result.push(node);
    }
    // Visit all nodes
    for (const node of nodes) {
        if (!visited.has(node)) {
            visit(node);
        }
    }
    return result;
}
