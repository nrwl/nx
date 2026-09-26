import { readNxJson } from '../../config/configuration';
import {
  AffectedTasksRequest,
  selectAffectedTasks,
} from '../../project-graph/affected/affected-tasks';
import type { SelectAffectedTasksResponse } from '../message-types/select-affected-tasks';
import { getIoSnapshotsForVersion } from './io-snapshots-state';
import { planningContextFor } from './planning-context';
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
    planningContextFor(projectGraph, nxJson),
    request,
    { ioSnapshots: getIoSnapshotsForVersion(request.ioSnapshots) }
  );

  const response: SelectAffectedTasksResponse = {
    projectGraph,
    affectedTaskIds: [...selection.affectedTaskIds],
    taskGraph: selection.taskGraph,
    taskSelection: selection.taskSelection,
  };
  return { response, description: 'handleSelectAffectedTasks' };
}
