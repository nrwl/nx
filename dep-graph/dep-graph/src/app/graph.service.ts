import { GraphService } from './graph';
import { GraphTooltipService } from './tooltip-service';

let graphService: GraphService;

export function useGraphService(): GraphService {
  if (!graphService) {
    graphService = new GraphService(
      new GraphTooltipService(),
      'cytoscape-graph'
    );
  }

  return graphService;
}
