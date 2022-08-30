import { getGraphService } from './graph.service';

export const graphActor = (callback, receive) => {
  const graphService = getGraphService();

  receive((e) => {
    const { selectedProjectNames, perfReport } = graphService.handleEvent(e);
    callback({
      type: 'setSelectedProjectsFromGraph',
      selectedProjectNames,
      perfReport,
    });
  });
};
