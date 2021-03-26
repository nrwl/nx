import * as cy from 'cytoscape';

export class ParentNode {
  constructor(
    private config: { id: string; parentId: string; label: string }
  ) {}

  getCytoscapeNodeDef(): cy.NodeDefinition {
    return {
      group: 'nodes',
      data: {
        id: this.config.id,
        parent: this.config.parentId,
        label: this.config.label,
      },
      selectable: false,
      grabbable: false,
      pannable: true,
    };
  }
}
