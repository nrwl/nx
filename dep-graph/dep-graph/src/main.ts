import { AppComponent } from './app/app';
import { environment } from './environments/environment';
import { projectGraphs } from './graphs';
import { smallGraph } from './graphs/small';

if (!environment.release) {
  const currentGraph = smallGraph;

  const nodes = Object.values(currentGraph.nodes).filter(
    (node) => node.type !== 'npm'
  );

  window.projects = nodes;
  window.graph = currentGraph;
  window.affected = [];
  window.exclude = [];
  window.projectGraphList = projectGraphs;
  window.selectedProjectGraph = projectGraphs[0].id;
}
setTimeout(() => new AppComponent(environment.appConfig));
