// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nrwl/devkit';
import { TaskGraphRecord } from '../interfaces';
import { TaskNode } from './task-node';
import { TaskEdge } from './task-edge';
import cytoscape, { Core } from 'cytoscape';

export class TaskTraversalGraph {
  private projects: ProjectGraphProjectNode[] = [];
  private taskGraphs: TaskGraphRecord = {};
  private cy: Core;

  setProjects(
    projects: ProjectGraphProjectNode[],
    taskGraphs: TaskGraphRecord
  ) {
    this.projects = projects;
    this.taskGraphs = taskGraphs;
  }

  selectTask(taskId: string) {
    this.createElements(taskId);

    return this.cy.elements();
  }

  private createElements(taskId: string) {
    const [projectName, target, configuration] = taskId.split(':');
    const taskGraph = this.taskGraphs[taskId];

    if (taskGraph === undefined) {
      console.log(this.taskGraphs);
      throw new Error(`Could not find task graph for ${taskId}`);
    }

    const project = this.projects.find(
      (project) => project.name === projectName
    );

    if (project === undefined) {
      throw new Error(`Could not find project ${projectName}`);
    }

    const taskElements = [];

    for (let taskName in taskGraph.tasks) {
      taskElements.push(
        new TaskNode(
          taskGraph.tasks[taskName],
          this.projects[taskGraph.tasks[taskName].target.project]
        )
      );
    }

    for (let topDep in taskGraph.dependencies) {
      taskGraph.dependencies[topDep].forEach((childDep) =>
        taskElements.push(new TaskEdge(topDep, childDep))
      );
    }

    this.cy = cytoscape({
      headless: true,
      elements: taskElements.map((element) => element.getCytoscapeNodeDef()),
      boxSelectionEnabled: false,
    });
  }
}
