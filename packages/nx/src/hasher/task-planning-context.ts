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
 * The graph copied into Rust and the planner built over it, shared by one
 * command's selection and hashing. Passed, not cached: `plans` is per command.
 */
export interface TaskPlanningContext {
  projectGraphRef: ExternalObject<NativeProjectGraph>;
  planner: HashPlanner;
  /**
   * Plans affected built, and the graph they were built for. The hasher
   * narrows them only for a graph that plans its tasks alike.
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
