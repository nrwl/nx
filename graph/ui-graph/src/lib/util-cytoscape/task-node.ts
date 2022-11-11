// nx-ignore-next-line
import type { ProjectGraphProjectNode, Task } from '@nrwl/devkit';
import * as cy from 'cytoscape';

export interface TaskNodeDataDefinition extends cy.NodeDataDefinition {
  id: string;
  executor: string;
}

export class TaskNode {
  constructor(private task: Task, private project: ProjectGraphProjectNode) {}

  getCytoscapeNodeDef(): cy.NodeDefinition {
    return {
      group: 'nodes',
      data: this.getData(),
      selectable: false,
      grabbable: false,
      pannable: true,
    };
  }

  private getData(): TaskNodeDataDefinition {
    return {
      id: this.task.id,
      executor: 'placeholder',
    };
  }
}
