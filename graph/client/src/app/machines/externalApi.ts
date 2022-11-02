import { getProjectGraphService } from './get-services';

export class ExternalApi {
  depGraphService = getProjectGraphService();

  focusProject(projectName: string) {
    this.depGraphService.send({ type: 'focusProject', projectName });
  }
}
