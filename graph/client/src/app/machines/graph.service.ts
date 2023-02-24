import { GraphService } from '@nrwl/graph/ui-graph';
import { selectValueByThemeStatic } from '../theme-resolver';
import { getEnvironmentConfig } from '../hooks/use-environment-config';

let graphService: GraphService;

export function getGraphService(): GraphService {
  const environment = getEnvironmentConfig();
  if (!graphService) {
    const darkModeEnabled = selectValueByThemeStatic(true, false);
    graphService = new GraphService(
      'cytoscape-graph',
      selectValueByThemeStatic('dark', 'light'),
      environment.environment === 'nx-console' ? 'nx-console' : 'graph-client'
    );
  }

  return graphService;
}
