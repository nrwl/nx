import { getDepGraphService } from './dep-graph.service';

export class ExternalApi {
  depGraphService = getDepGraphService();

  focusProject(projectName: string) {
    this.depGraphService.send({ type: 'focusProject', projectName });
  }
}
