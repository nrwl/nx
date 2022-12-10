import { getProjectGraphService } from './machines/get-services';

export class ExternalApi {
  projectGraphService = getProjectGraphService();

  focusProject(projectName: string) {
    this.projectGraphService.send({ type: 'focusProject', projectName });
  }

  enableExperimentalFeatures() {
    localStorage.setItem('showExperimentalFeatures', 'true');
    window.appConfig.showExperimentalFeatures = true;
  }

  disableExperimentalFeatures() {
    localStorage.setItem('showExperimentalFeatures', 'false');
    window.appConfig.showExperimentalFeatures = false;
  }
}
