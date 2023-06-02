import { GraphService } from '@nx/graph/ui-graph';
import { selectValueByThemeStatic } from '../theme-resolver';

let graphService: GraphService;

export function getGraphService(): GraphService {
  if (!graphService) {
    const darkModeEnabled = selectValueByThemeStatic(true, false);
    graphService = new GraphService(
      'cytoscape-graph',
      selectValueByThemeStatic('dark', 'light')
    );
  }

  return graphService;
}
