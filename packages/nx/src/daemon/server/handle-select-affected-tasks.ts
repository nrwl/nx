import type { Socket } from 'net';
import { readNxJson } from '../../config/configuration';
import {
  AffectedTasksRequest,
  selectAffectedTasks,
} from '../../project-graph/affected/affected-tasks';
import { ProgressTopics } from '../../utils/progress-topics';
import type { SelectAffectedTasksResponse } from '../message-types/select-affected-tasks';
import {
  subscribeClientToTopic,
  unsubscribeClientFromTopic,
} from './client-socket-context';
import { getUltracacheConfigurationsForVersion } from './ultracache-configuration-state';
import { planningContextFor } from './planning-context';
import { getCachedSerializedProjectGraphPromise } from './project-graph-incremental-recomputation';
import type { HandlerResult } from './server';

export async function handleSelectAffectedTasks(
  request: AffectedTasksRequest,
  socket: Socket
): Promise<HandlerResult> {
  const { error, projectGraph } =
    await getCachedSerializedProjectGraphPromise(socket);
  if (error) {
    throw error;
  }

  const nxJson = readNxJson();
  subscribeClientToTopic(socket, ProgressTopics.AffectedTasks);
  try {
    const selection = await selectAffectedTasks(
      projectGraph,
      nxJson,
      planningContextFor(projectGraph, nxJson),
      request,
      {
        ultracacheConfigurations: getUltracacheConfigurationsForVersion(
          request.ultracacheConfigurationsVersion
        ),
      }
    );

    const response: SelectAffectedTasksResponse = {
      projectGraph,
      affectedTaskIds: [...selection.affectedTaskIds],
      taskGraph: selection.taskGraph,
      taskSelection: selection.taskSelection,
      explanation: selection.explanation,
    };
    return { response, description: 'handleSelectAffectedTasks' };
  } finally {
    unsubscribeClientFromTopic(socket, ProgressTopics.AffectedTasks);
  }
}
