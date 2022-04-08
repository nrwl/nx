import { GraphTooltipService } from '../tooltip-service';
import { GraphService } from './graph';

let graphService: GraphService;

export function getGraphService(): GraphService {
  if (!graphService) {
    graphService = new GraphService(
      new GraphTooltipService(),
      'cytoscape-graph'
    );
  }

  return graphService;
}
