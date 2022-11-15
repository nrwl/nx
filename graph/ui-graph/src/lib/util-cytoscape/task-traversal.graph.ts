// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nrwl/devkit';
import { TaskGraphRecord } from '../interfaces';
import { TaskNode } from './task-node';
import { TaskEdge } from './task-edge';
import cytoscape, { Core } from 'cytoscape';
import { ParentNode } from './parent-node';

export class TaskTraversalGraph {
  private projects: ProjectGraphProjectNode[] = [];
  private taskGraphs: TaskGraphRecord = {};
  private cy: Core;
  private selectedTask: string;
  private groupByProject: boolean = false;

  setProjects(
    projects: ProjectGraphProjectNode[],
    taskGraphs: TaskGraphRecord
  ) {
    this.selectedTask = null;
    this.projects = projects;
    this.taskGraphs = taskGraphs;
  }

  selectTask(taskId: string) {
    this.selectedTask = taskId;
    this.createElements(taskId, this.groupByProject);

    return this.cy.elements();
  }

  setGroupByProject(groupByProject: boolean) {
    this.groupByProject = groupByProject;

    if (this.selectedTask) {
      this.createElements(this.selectedTask, groupByProject);
    } else {
      this.cy = cytoscape({
        headless: true,
        elements: [],
      });

      return this.cy.elements();
    }

    return this.cy.elements();
  }

  deselectTask() {
    this.cy = cytoscape({
      headless: true,
      elements: [],
    });

    return this.cy.elements();
  }

  private createElements(taskId: string, groupByFolder: boolean) {
    const taskGraph = this.taskGraphs[taskId];

    if (taskGraph === undefined) {
      throw new Error(`Could not find task graph for ${taskId}`);
    }

    const taskElements = [];

    const parents: Record<
      string,
      { id: string; parentId: string; label: string }
    > = {};

    for (let taskName in taskGraph.tasks) {
      const task = taskGraph.tasks[taskName];
      const project = this.projects.find(
        (project) => project.name === task.target.project
      );

      if (project === undefined) {
        throw new Error(`Could not find project ${project.name}`);
      }

      taskElements.push(new TaskNode(taskGraph.tasks[taskName], project));

      if (groupByFolder) {
        parents[project.name] = {
          id: project.name,
          parentId: null,
          label: project.name,
        };
      }
    }

    for (let parent in parents) {
      taskElements.push(new ParentNode(parents[parent]));
    }

    for (let topDep in taskGraph.dependencies) {
      taskGraph.dependencies[topDep].forEach((childDep) =>
        taskElements.push(new TaskEdge(topDep, childDep))
      );
    }

    this.cy = cytoscape({
      headless: true,
      elements: taskElements.map((element) =>
        element.getCytoscapeNodeDef(groupByFolder)
      ),
      boxSelectionEnabled: false,
    });
  }
}
