import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import type { TaskGraph } from '../config/task-graph';
import {
  ExternalObject,
  HashPlanner,
  HashInstruction,
  ProjectGraph as NativeProjectGraph,
} from '../native';
import { transformProjectGraphForRust } from '../native/transform-objects';

/**
 * The graph copied into Rust and the planner built over it, passed between the phases
 * of one command.
 *
 * Task-grained affected plans the candidate tasks to decide what is affected,
 * and the hasher then plans the survivors. A planner carries `subtree_memo`,
 * `instruction_pool` and `external_deps_mapped` across `getPlans` calls, so
 * handing the same instance to both makes the second pass mostly memo hits.
 *
 * Threaded as an argument rather than held in a module-level cache, because
 * `plans` below is per-command rather than per-graph: two runs over the same
 * graph select different tasks. The graph copy itself is cached, by
 * `transformProjectGraphForRust`.
 */
export interface TaskPlanningContext {
  projectGraphRef: ExternalObject<NativeProjectGraph>;
  planner: HashPlanner;
  /**
   * Plans for the task set affected already walked, and the graph they were
   * built for. The hasher narrows these to the tasks it was given when its graph
   * plans them alike, so this is an optimisation and never a contract.
   */
  plans?: {
    plans: ExternalObject<Record<string, Array<HashInstruction>>>;
    taskGraph: TaskGraph;
  };
}

export function createTaskPlanningContext(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): TaskPlanningContext {
  const projectGraphRef = transformProjectGraphForRust(projectGraph);
  return {
    projectGraphRef,
    planner: new HashPlanner(nxJson, projectGraphRef),
  };
}
