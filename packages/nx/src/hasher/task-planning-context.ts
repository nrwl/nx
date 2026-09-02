import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import {
  ExternalObject,
  HashPlanner,
  HashInstruction,
  ProjectGraph as NativeProjectGraph,
} from '../native';
import { marshalGraph } from '../project-graph/affected/marshal-graph';

/**
 * A marshalled graph and the planner built over it, passed between the phases
 * of one command.
 *
 * Task-grained affected plans the candidate tasks to decide what is affected,
 * and the hasher then plans the survivors. A planner carries `subtree_memo`,
 * `instruction_pool` and `external_deps_mapped` across `getPlans` calls, so
 * handing the same instance to both makes the second pass mostly memo hits.
 *
 * Threaded as an argument rather than held in a module-level cache, because
 * `plans` below is per-command rather than per-graph: two runs over the same
 * graph select different tasks. The marshalled graph is cached, in
 * ../project-graph/affected/marshal-graph.
 */
export interface TaskPlanningContext {
  projectGraphRef: ExternalObject<NativeProjectGraph>;
  planner: HashPlanner;
  /**
   * Plans for the task set affected already walked. The hasher narrows these to
   * the tasks it was given instead of planning them again; it falls back when
   * they cannot answer, so this is an optimisation and never a contract.
   */
  plans?: ExternalObject<Record<string, Array<HashInstruction>>>;
}

export function createTaskPlanningContext(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): TaskPlanningContext {
  const projectGraphRef = marshalGraph(projectGraph);
  return {
    projectGraphRef,
    planner: new HashPlanner(nxJson as any, projectGraphRef),
  };
}
