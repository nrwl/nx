import { InvokeCallback } from 'xstate';

import { ProjectGraphEvent } from '@nx/graph/projects';
import { RenderGraphConfigEvent } from '@nx/graph';
import { TaskGraphClientActor } from './interfaces';
import { TaskGraphEvent } from '@nx/graph/tasks/task-graph-event';

export const graphClientActor =
  ({
    graphClient,
    send,
    sendRenderConfigEvent,
  }: TaskGraphClientActor): InvokeCallback<
    TaskGraphEvent | RenderGraphConfigEvent,
    TaskGraphMachineEvents
  > =>
  (callback, onReceive) => {
    onReceive((event) => {
      if (
        event.type === 'ThemeChange' ||
        event.type === 'ResetLayout' ||
        event.type === 'RankDirChange'
      ) {
        sendRenderConfigEvent(event);
      } else {
        send(event);
      }

      callback({ type: 'setGraphClientState', state: graphClient.graphState });
    });
  };
