import { FetchProjectGraphService } from '../app/fetch-project-graph-service';
import { Environment } from '../app/models';

export const environment: Environment = {
  environment: 'release',
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
    projectGraphService: new FetchProjectGraphService(),
  },
};
