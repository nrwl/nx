import { GraphService } from '@nx/graph/ui-graph';
import { selectValueByThemeStatic } from '../theme-resolver';
import { getEnvironmentConfig } from '../hooks/use-environment-config';
import { getProjectGraphDataService } from '../hooks/get-project-graph-data-service';

let graphService: GraphService;

export function getGraphService(): GraphService {
  const environment = getEnvironmentConfig();
  if (!graphService) {
    const projectDataService = getProjectGraphDataService();
    graphService = new GraphService(
      'cytoscape-graph',
      selectValueByThemeStatic('dark', 'light'),
      environment.environment === 'nx-console' ? 'nx-console' : undefined,
      'TB',
      projectDataService.getExpandedTaskInputs
    );
  }

  return graphService;
}
