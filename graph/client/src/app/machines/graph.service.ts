import { GraphService } from '@nx/graph/ui-graph';
import { selectValueByThemeStatic } from '../theme-resolver';
import { getEnvironmentConfig } from '../hooks/use-environment-config';

let graphService: GraphService;

export function getGraphService(): GraphService {
  const environment = getEnvironmentConfig();
  if (!graphService) {
    graphService = new GraphService(
      'cytoscape-graph',
      selectValueByThemeStatic('dark', 'light'),
      environment.environment === 'nx-console' ? 'nx-console' : undefined
    );
  }

  return graphService;
}
