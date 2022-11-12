import { getGraphService } from '../../machines/graph.service';

export const taskGraphRenderActor = (callback, receive) => {
  const graphService = getGraphService();

  receive((e) => {
    graphService.handleTaskEvent(e);
  });
};
