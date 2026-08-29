import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import {
  ExternalObject,
  HashPlanner,
  HashInstruction,
  ProjectGraph as NativeProjectGraph,
  transferProjectGraph,
} from '../native';
import { transformProjectGraphForRust } from '../native/transform-objects';

/**
 * A marshalled graph and the planner built over it, passed between the phases
 * of one command.
 *
 * Task-grained affected plans the candidate tasks to decide what is affected,
 * and the hasher then plans the survivors. A planner carries `subtree_memo`,
 * `instruction_pool` and `external_deps_mapped` across `getPlans` calls, so
 * handing the same instance to both makes the second pass mostly memo hits.
 *
 * Threaded as an argument rather than held in a module-level cache. A cache
 * keyed on the graph works, but it retains napi objects for as long as the
 * graph is reachable, and that kept a vitest worker alive past the end of the
 * run (116/116 tests became 104/116, reproducibly). A JS `WeakRef` would drop
 * the retention but makes the planner's lifetime depend on GC timing, so a run
 * could silently lose the memo partway through. Passing it explicitly is
 * deterministic and scopes it to the command.
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
  nxJson: NxJsonConfiguration,
  /** Reuses a marshal the caller already paid for. */
  existingRef?: ExternalObject<NativeProjectGraph>
): TaskPlanningContext {
  const projectGraphRef =
    existingRef ??
    transferProjectGraph(transformProjectGraphForRust(projectGraph));
  return {
    projectGraphRef,
    planner: new HashPlanner(nxJson as any, projectGraphRef),
  };
}
