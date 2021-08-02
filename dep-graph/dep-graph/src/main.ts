import { AppComponent } from './app/app';
import { LocalProjectGraphService } from './app/local-project-graph-service';
import { environment } from './environments/environment';

if (environment.environment === 'dev-watch') {
  window.watch = true;
}

if (environment.environment === 'release' && window.localMode === 'build') {
  environment.appConfig.projectGraphService = new LocalProjectGraphService();
}

setTimeout(() => new AppComponent(environment.appConfig));
