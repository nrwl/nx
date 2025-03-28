import { getGraphService } from '../../machines/graph.service';

export const graphActor = (callback, receive) => {
  const graphService = getGraphService();

  receive((e) => {
    const { selectedProjectNames, perfReport, compositeNodes } =
      graphService.handleProjectEvent(e);
    callback({
      type: 'setSelectedProjectsFromGraph',
      selectedProjectNames,
      perfReport,
      compositeNodes,
    });
  });
};
