/**
 * A representation of the invocation of an Executor
 */
export interface Task {
  /**
   * Unique ID
   */
  id: string;
  /**
   * Details about which project, target, and configuration to run.
   */
  target: {
    /**
     * The project for which the task belongs to
     */
    project: string;
    /**
     * The target name which the task should invoke
     */
    target: string;
    /**
     * The configuration of the target which the task invokes
     */
    configuration?: string;
  };
  /**
   * Overrides for the configured options of the target
   */
  overrides: any;
  /**
   * Root of the project the task belongs to
   */
  projectRoot?: string;
  /**
   * Hash of the task which is used for caching.
   */
  hash?: string;
  /**
   * Details about the composition of the hash
   */
  hashDetails?: {
    /**
     * Command of the task
     */
    command: string;
    /**
     * Hashes of inputs used in the hash
     */
    nodes: { [name: string]: string };
    /**
     * Hashes of implicit dependencies which are included in the hash
     */
    implicitDeps?: { [fileName: string]: string };
    /**
     * Hash of the runtime environment which the task was executed
     */
    runtime?: { [input: string]: string };
  };
}

/**
 * Graph of Tasks to be executed
 */
export interface TaskGraph {
  /**
   * IDs of Tasks which do not have any dependencies and are thus ready to execute immediately
   */
  roots: string[];
  /**
   * Map of Task IDs to Tasks
   */
  tasks: Record<string, Task>;
  /**
   * Map of Task IDs to IDs of tasks which the task depends on
   */
  dependencies: Record<string, string[]>;
}
