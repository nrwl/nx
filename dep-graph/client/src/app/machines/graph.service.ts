import { getTooltipService } from '../tooltip-service';
import { GraphService } from './graph';

let graphService: GraphService;

export function getGraphService(): GraphService {
  if (!graphService) {
    graphService = new GraphService(getTooltipService(), 'cytoscape-graph');
  }

  return graphService;
}
