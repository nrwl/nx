import { NxJsonConfiguration } from '../config/nx-json';
import { ProjectGraph } from '../config/project-graph';
import {
  ExternalObject,
  HashPlanner,
  ProjectGraph as NativeProjectGraph,
} from '../native';
import { transformProjectGraphForRust } from '../native/transform-objects';

/**
 * The graph copied into Rust and the planner built over it, shared by selection
 * and hashing. The planner remembers its last plans, so the run's hashing reuses
 * what selection planned.
 */
export interface TaskPlanningContext {
  projectGraphRef: ExternalObject<NativeProjectGraph>;
  planner: HashPlanner;
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
