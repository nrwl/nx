import { AppComponent } from './app/app';
import { LocalProjectGraphService } from './app/local-project-graph-service';
import { environment } from './environments/environment';
import { projectGraphs } from './graphs';

if (environment.environment !== 'release') {
  window.affected = [];
  window.exclude = [];
  window.projectGraphList = projectGraphs;
  window.selectedProjectGraph = projectGraphs[0].id;
}

if (environment.environment === 'dev-watch') {
  window.watch = true;
}

if (environment.environment === 'release' && window.localMode === 'build') {
  environment.appConfig.projectGraphService = new LocalProjectGraphService();
}

setTimeout(() => new AppComponent(environment.appConfig));
