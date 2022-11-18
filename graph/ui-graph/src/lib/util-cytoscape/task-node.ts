// nx-ignore-next-line
import type { ProjectGraphProjectNode, Task } from '@nrwl/devkit';
import * as cy from 'cytoscape';

export interface TaskNodeDataDefinition extends cy.NodeDataDefinition {
  id: string;
  label: string;
  executor: string;
}

export class TaskNode {
  constructor(private task: Task, private project: ProjectGraphProjectNode) {}

  getCytoscapeNodeDef(groupByProject: boolean): cy.NodeDefinition {
    return {
      group: 'nodes',
      classes: 'task',
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
    };
  }
}
