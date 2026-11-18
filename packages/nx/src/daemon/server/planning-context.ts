import type { NxJsonConfiguration } from '../../config/nx-json';
import type { ProjectGraph } from '../../config/project-graph';
import {
  createTaskPlanningContext,
  TaskPlanningContext,
} from '../../hasher/task-planning-context';

let stored: {
  projectGraph: ProjectGraph;
  context: TaskPlanningContext;
} | null = null;

/**
 * One planner per daemon project graph, shared by affected selection and task
 * hashing, so hashing reuses the plans selection made.
 */
export function planningContextFor(
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration
): TaskPlanningContext {
  if (stored?.projectGraph !== projectGraph) {
    stored = {
      projectGraph,
      context: createTaskPlanningContext(projectGraph, nxJson),
    };
  }
  return stored.context;
}
