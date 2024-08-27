import { GraphService } from '@nx/graph/ui-graph';
import {
  getEnvironmentConfig,
  getProjectGraphDataService,
} from '@nx/graph/shared';
import { selectValueByThemeStatic } from '@nx/graph-internal/ui-theme';

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
      (taskId: string) => projectDataService.getExpandedTaskInputs(taskId)
    );
  }

  return graphService;
}
