import { RenderGraphConfigEvent } from '@nx/graph';
import {
  TaskGraphClient,
  TaskGraphHandleEventResult,
} from '@nx/graph/tasks/task-graph-client';
import { TaskGraphEvent } from '@nx/graph/tasks/task-graph-event';

export interface TaskGraphClientActor {
  graphClient: TaskGraphClient;
  send: (...events: TaskGraphEvent[]) => TaskGraphHandleEventResult | undefined;
  sendRenderConfigEvent: (event: RenderGraphConfigEvent) => void;
}
