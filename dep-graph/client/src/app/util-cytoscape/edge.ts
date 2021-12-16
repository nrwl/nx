import type { ProjectGraphDependency } from '@nrwl/devkit';
import * as cy from 'cytoscape';

export class ProjectEdge {
  affected = false;

  constructor(private dep: ProjectGraphDependency) {}

  getCytosacpeNodeDef(): cy.NodeDefinition {
    let edge: cy.EdgeDefinition;
    edge = {
      group: 'edges',
      data: {
        id: `${this.dep.source}|${this.dep.target}`,
        source: this.dep.source,
        target: this.dep.target,
      },
    };
    edge.classes = this.dep.type ?? '';
    if (this.affected) {
      edge.classes += ' affected';
    }

    return edge;
  }
}
