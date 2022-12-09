import { getRouter } from './get-router';

export class ExternalApi {
  router = getRouter();

  focusProject(projectName: string) {
    this.router.navigate(`/projects/${projectName}`);
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
