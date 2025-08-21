import { InvokeCallback } from 'xstate';
import { TaskGraphClientActor } from './interfaces';
import { TaskGraphEvent } from '@nx/graph/tasks/task-graph-event';
import { RenderGraphConfigEvent } from '@nx/graph';

export const graphClientActor =
  ({
    graphClient,
    send,
    sendRenderConfigEvent,
  }: TaskGraphClientActor): InvokeCallback<
    TaskGraphEvent | RenderGraphConfigEvent,
    any
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
        console.log('sending event', event);
        send(event);
      }

      callback({ type: 'setGraphClientState', state: graphClient.graphState });
    });
  };