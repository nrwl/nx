import { AppComponent } from './app/app';
import { environment } from './environments/environment';
import { projectGraphs } from './graphs';
import { nxGraph } from './graphs/nx';

if (!environment.release) {
  const currentGraph = nxGraph;

  const nodes = Object.values(currentGraph.nodes).filter(
    (node) => node.type !== 'npm'
  );

  window.projects = nodes;
  window.graph = currentGraph;
  window.affected = [];
  window.exclude = [];
  window.projectGraphList = projectGraphs;
  window.selectedProjectGraph = projectGraphs[0].id;
  window.workspaceLayout = projectGraphs[0].workspaceLayout;
}
setTimeout(() => new AppComponent(environment.appConfig));
