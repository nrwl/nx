import { MockProjectGraphService } from '../app/mock-project-graph-service';
import { Environment } from '../app/models';

export const environment: Environment = {
  environment: 'dev-watch',
  appConfig: {
    showDebugger: false,
    projectGraphs: [
      {
        id: 'local',
        label: 'local',
        url: 'projectGraph.json',
      },
    ],
    defaultProjectGraph: 'local',
    projectGraphService: new MockProjectGraphService(),
  },
};
