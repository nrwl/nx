import { InvokeCallback } from 'xstate';
import {
  ProjectGraphClientActor,
  ProjectGraphMachineEvents,
} from './interfaces';
import {
  ProjectGraphEvent,
  ProjectGraphRenderScratchData,
} from '@nx/graph/projects';
import { RenderGraphConfigEvent, RenderGraphScratchPad } from '@nx/graph';

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
        send(event);
      }

      const renderGraphScratchPad: RenderGraphScratchPad<ProjectGraphRenderScratchData> =
        graphClient['renderGraph']['scratchPad'];

      const renderGraphData = renderGraphScratchPad.get();

      callback({
        type: 'setGraphClientState',
        state: renderGraphData,
      });
    });
  };
