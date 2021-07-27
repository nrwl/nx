import { FetchProjectGraphService } from '../app/fetch-project-graph-service';
import { Environment } from '../app/models';
import { projectGraphs } from '../graphs';

export const environment: Environment = {
  environment: 'dev',
  appConfig: {
    showDebugger: true,
    projectGraphs,
    defaultProjectGraph: 'nx',
    projectGraphService: new FetchProjectGraphService(),
  },
};
