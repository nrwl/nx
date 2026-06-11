/**
 * Graph of Tasks to be executed
 */
export interface CommandGraph {
    /**
     * Projects that do not have any dependencies and are thus ready to execute immediately
     */
    roots: string[];
    /**
     * Map of projects to projects which the task depends on
     */
    dependencies: Record<string, string[]>;
}
