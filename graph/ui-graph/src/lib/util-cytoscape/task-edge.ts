import * as cy from 'cytoscape';

export interface TaskEdgeDataDefinition extends cy.NodeDataDefinition {
  id: string;
  source: string;
  target: string;
}

export class TaskEdge {
  constructor(private source: string, private target: string) {}

  getCytoscapeNodeDef(): cy.NodeDefinition {
    let edge: cy.EdgeDefinition;
    edge = {
      group: 'edges',
      data: {
        id: `${this.source}|${this.target}`,
        source: this.source,
        target: this.target,
      },
    };

    return edge;
  }
}
