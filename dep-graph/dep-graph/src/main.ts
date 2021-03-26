import { AppComponent } from './app/app';
import { mediumGraph } from './graphs/medium';

const currentGraph = mediumGraph;

const nodes = Object.values(currentGraph.nodes).filter(
  (node) => node.type !== 'npm'
);

window.projects = nodes;
window.graph = currentGraph;
window.affected = [];
window.exclude = [];

setTimeout(() => new AppComponent());
