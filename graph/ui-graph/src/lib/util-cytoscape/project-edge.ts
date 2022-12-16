// nx-ignore-next-line
import type { ProjectGraphDependency } from '@nrwl/devkit';
import * as cy from 'cytoscape';

export interface ProjectEdgeDataDefinition extends cy.NodeDataDefinition {
  id: string;
  source: string;
  target: string;
  type: 'static' | 'dynamic' | 'implicit';
}

export class ProjectEdge {
  affected = false;

  constructor(private dep: ProjectGraphDependency) {}

  getCytoscapeNodeDef(): cy.EdgeDefinition {
    let edge: cy.EdgeDefinition;
    edge = {
      group: 'edges',
      classes: 'projectEdge',
      data: {
        id: `${this.dep.source}|${this.dep.target}`,
        source: this.dep.source,
        target: this.dep.target,
        type: this.dep.type,
      },
    };
    edge.classes += ` ${this.dep.type}` ?? '';
    if (this.affected) {
      edge.classes += ' affected';
    }

    return edge;
  }
}
