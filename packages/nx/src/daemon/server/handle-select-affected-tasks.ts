import { readNxJson } from '../../config/configuration';
import { createTaskPlanningContext } from '../../hasher/task-planning-context';
import {
  AffectedTasksRequest,
  selectAffectedTasks,
} from '../../project-graph/affected/affected-tasks';
import type { SelectAffectedTasksResponse } from '../message-types/select-affected-tasks';
import { keepSelectionPlans } from './handle-hash-tasks';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import type { HandlerResult } from './server';

export async function handleSelectAffectedTasks(
  request: AffectedTasksRequest
): Promise<HandlerResult> {
  const { error, projectGraph } =
    await getCachedSerializedProjectGraphPromise();
  if (error) {
    throw error;
  }

  const nxJson = readNxJson();
  const selection = await selectAffectedTasks(
    projectGraph,
    nxJson,
    createTaskPlanningContext(projectGraph, nxJson),
    request
  );
  if (selection.plans) {
    keepSelectionPlans(projectGraph, selection.taskGraph, selection.plans);
  }

  const response: SelectAffectedTasksResponse = {
    affectedTaskIds: [...selection.affectedTaskIds],
    requiredTaskIds: selection.requiredTaskIds,
    runTaskGraph: selection.runTaskGraph,
    taskGraph: selection.taskGraph,
  };
  return { response, description: 'handleSelectAffectedTasks' };
}
