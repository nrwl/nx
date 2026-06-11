/**
 * Topologically sorts a directed graph, returning the sorted nodes.
 * Handles cycles by breaking them where needed.
 *
 * @param nodes All nodes in the graph
 * @param getEdges Function that returns outgoing edges for a node
 * @returns Topologically sorted list of nodes
 */
export declare function topologicalSort<T>(nodes: T[], getEdges: (node: T) => T[]): T[];
