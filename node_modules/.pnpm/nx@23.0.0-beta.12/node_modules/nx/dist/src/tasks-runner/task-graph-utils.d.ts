import { ProjectGraph } from '../config/project-graph';
import { TaskGraph } from '../config/task-graph';
/**
 * This function finds a cycle in the graph.
 * @returns the first cycle found, or null if no cycle is found.
 */
export declare function findCycle(graph: {
    dependencies: Record<string, string[]>;
    continuousDependencies?: Record<string, string[]>;
}): string[] | null;
/**
 * This function finds all cycles in the graph.
 * @returns a list of unique task ids in all cycles found, or null if no cycle is found.
 */
export declare function findCycles(graph: {
    dependencies: Record<string, string[]>;
    continuousDependencies?: Record<string, string[]>;
}): Set<string> | null;
export declare function makeAcyclic(graph: {
    roots: string[];
    dependencies: Record<string, string[]>;
}): void;
export declare function validateNoAtomizedTasks(taskGraph: TaskGraph, projectGraph: ProjectGraph): void;
export declare function assertTaskGraphDoesNotContainInvalidTargets(taskGraph: TaskGraph): void;
export declare function getLeafTasks(taskGraph: TaskGraph): Set<string>;
/**
 * Walk a task graph topologically, calling walkFn for each wave of roots.
 * Considers both dependencies and continuousDependencies.
 */
export declare function walkTaskGraph(taskGraph: TaskGraph, walkFn: (rootTaskIds: string[]) => Promise<void>): Promise<void>;
