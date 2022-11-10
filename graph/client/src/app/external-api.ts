import { getProjectGraphService } from './machines/get-services';

export class ExternalApi {
  projectGraphService = getProjectGraphService();

  focusProject(projectName: string) {
    this.projectGraphService.send({ type: 'focusProject', projectName });
  }

  enableExperimentalFeatures() {
    window.appConfig.showExperimentalFeatures = true;
  }
}
