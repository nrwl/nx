import { InvokeCallback } from 'xstate';
import {
  ProjectGraphClientActor,
  ProjectGraphMachineEvents,
} from './interfaces';
import { ProjectGraphEvent } from '@nx/graph/projects';
import { RenderGraphConfigEvent } from '@nx/graph';

export const graphClientActor =
  ({
    graphClient,
    send,
    sendRenderConfigEvent,
  }: ProjectGraphClientActor): InvokeCallback<
    ProjectGraphEvent | RenderGraphConfigEvent,
    ProjectGraphMachineEvents
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
