import { AppComponent } from './app/app';
import { LocalProjectGraphService } from './app/local-project-graph-service';
import { inspect } from '@xstate/inspect';
import { ProjectGraphService } from './app/models';
import { MockProjectGraphService } from './app/mock-project-graph-service';
import { FetchProjectGraphService } from './app/fetch-project-graph-service';

if (window.useXstateInspect === true) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false, // open in new window
  });
}

let projectGraphService: ProjectGraphService;

if (window.environment === 'dev') {
  projectGraphService = new FetchProjectGraphService();
} else if (window.environment === 'watch') {
  projectGraphService = new MockProjectGraphService();
} else if (window.environment === 'release') {
  if (window.localMode === 'build') {
    projectGraphService = new LocalProjectGraphService();
  } else {
    projectGraphService = new FetchProjectGraphService();
  }
}

setTimeout(() => new AppComponent(window.appConfig, projectGraphService));
