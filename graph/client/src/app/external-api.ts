import { getRouter } from './get-router';
import { getProjectGraphService } from './machines/get-services';
import { ProjectGraphMachineEvents } from './feature-projects/machines/interfaces';
import { getGraphService } from './machines/graph.service';

export class ExternalApi {
  _projectGraphService = getProjectGraphService();
  _graphIsReady = new Promise<void>((resolve) => {
    this._projectGraphService.subscribe((state) => {
      if (!state.matches('idle')) {
        resolve();
      }
    });
  });

  router = getRouter();
  graphService = getGraphService();

  projectGraphService = {
    send: (event: ProjectGraphMachineEvents) => {
      this.handleLegacyProjectGraphEvent(event);
    },
  };

  private fileClickCallbackListeners: ((url: string) => void)[] = [];

  get depGraphService() {
    return this.projectGraphService;
  }

  constructor() {
    this.graphService.listen((event) => {
      if (event.type === 'FileLinkClick') {
        const url = `${event.sourceRoot}/${event.file}`;
        this.fileClickCallbackListeners.forEach((cb) => cb(url));
      }
    });
  }

  focusProject(projectName: string) {
    this.router.navigate(`/projects/${encodeURIComponent(projectName)}`);
  }

  selectAllProjects() {
    this.router.navigate(`/projects/all`);
  }

  enableExperimentalFeatures() {
    localStorage.setItem('showExperimentalFeatures', 'true');
    window.appConfig.showExperimentalFeatures = true;
  }

  disableExperimentalFeatures() {
    localStorage.setItem('showExperimentalFeatures', 'false');
    window.appConfig.showExperimentalFeatures = false;
  }

  registerFileClickCallback(callback: (url: string) => void) {
    this.fileClickCallbackListeners.push(callback);
  }

  private handleLegacyProjectGraphEvent(event: ProjectGraphMachineEvents) {
    switch (event.type) {
      case 'focusProject':
        this.focusProject(event.projectName);
        break;
      case 'selectAll':
        this.selectAllProjects();
        break;
      default:
        this._graphIsReady.then(() => this._projectGraphService.send(event));
        break;
    }
  }
}
