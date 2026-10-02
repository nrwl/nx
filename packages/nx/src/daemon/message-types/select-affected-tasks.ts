import type { ProjectGraph } from '../../config/project-graph';
import type { TaskGraph } from '../../config/task-graph';
import type { TaskSelection } from '../../tasks-runner/run-command';
import type { AffectedTasksRequest } from '../../project-graph/affected/affected-tasks';
import type { InternedExplanation } from '../../project-graph/affected/affected-reasons';

export const SELECT_AFFECTED_TASKS = 'SELECT_AFFECTED_TASKS' as const;

export type HandleSelectAffectedTasksMessage = {
  type: typeof SELECT_AFFECTED_TASKS;
  request: AffectedTasksRequest;
};

export type SelectAffectedTasksResponse = {
  /** The graph selection ran against, for the command to run with. */
  projectGraph: ProjectGraph;
  affectedTaskIds: string[];
  taskGraph: TaskGraph;
  /** Without a planning context: the plans stay in the daemon. */
  taskSelection: TaskSelection;
  /** Interned, so it stays small on the wire; the client hydrates it. */
  explanation?: InternedExplanation;
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
