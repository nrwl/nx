/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode, Task } from '@nx/devkit';
/* eslint-enable @nx/enforce-module-boundaries */
import * as cy from 'cytoscape';

export interface TaskNodeDataDefinition extends cy.NodeDataDefinition {
  id: string;
  label: string;
  executor: string;
  description?: string;
}

export class TaskNode {
  constructor(private task: Task, private project: ProjectGraphProjectNode) {}

  getCytoscapeNodeDef(
    groupByProject: boolean
  ): cy.NodeDefinition & { pannable: boolean } {
    return {
      group: 'nodes',
      classes: 'taskNode',
      data: this.getData(groupByProject),
      selectable: false,
      grabbable: false,
      pannable: true,
    };
  }

  private getData(groupByProject: boolean): TaskNodeDataDefinition {
    const label = groupByProject
      ? this.task.id.split(':').slice(1).join(':')
      : this.task.id;
    return {
      id: this.task.id,
      label,
      executor: this.project.data.targets[this.task.target.target].executor,
      parent: groupByProject ? this.task.target.project : null,
      description: this.project.data.description,
    };
  }
}
