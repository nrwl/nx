import type { ProjectGraph } from '../../config/project-graph';
import type { TaskGraph } from '../../config/task-graph';
import type { AffectedTasksRequest } from '../../project-graph/affected/affected-tasks';

export const SELECT_AFFECTED_TASKS = 'SELECT_AFFECTED_TASKS' as const;

export type HandleSelectAffectedTasksMessage = {
  type: typeof SELECT_AFFECTED_TASKS;
  request: AffectedTasksRequest;
};

export type SelectAffectedTasksResponse = {
  /** The graph selection ran against, for the command to run with. */
  projectGraph: ProjectGraph;
  affectedTaskIds: string[];
  requiredTaskIds: string[];
  taskGraph: TaskGraph;
  runTaskGraph?: TaskGraph;
};

export function isHandleSelectAffectedTasksMessage(
  message: unknown
): message is HandleSelectAffectedTasksMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    'type' in message &&
    message['type'] === SELECT_AFFECTED_TASKS
  );
}
