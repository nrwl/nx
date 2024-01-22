/* eslint-disable @nx/enforce-module-boundaries */
// nx-ignore-next-line
import type { ProjectGraphProjectNode } from '@nx/devkit';
/* eslint-enable @nx/enforce-module-boundaries */
import { TaskGraphRecord } from '../interfaces';
import { TaskNode } from './task-node';
import { TaskEdge } from './task-edge';
import cytoscape, { Core } from 'cytoscape';
import { ParentNode } from './parent-node';

export class TaskTraversalGraph {
  private projects: ProjectGraphProjectNode[] = [];
  private taskGraphs: TaskGraphRecord = {};
  private cy: Core;
  private groupByProject: boolean = false;
  private selectedTasks = new Set<string>();

  setProjects(
    projects: ProjectGraphProjectNode[],
    taskGraphs: TaskGraphRecord
  ) {
    this.selectedTasks.clear();
    this.projects = projects;
    this.taskGraphs = taskGraphs;
  }

  setGroupByProject(groupByProject: boolean) {
    this.groupByProject = groupByProject;

    if (this.selectedTasks.size > 0) {
      this.createElements(Array.from(this.selectedTasks), groupByProject);
    } else {
      this.cy = cytoscape({
        headless: true,
        elements: [],
      });
    }

    return this.cy.elements();
  }

  setTasks(taskIds: string[]) {
    let changed = false;
    this.selectedTasks.forEach((selectedTask) => {
      if (!taskIds.includes(selectedTask)) {
        this.selectedTasks.delete(selectedTask);
        changed = true;
      }
    });
    for (const taskId of taskIds) {
      if (!this.selectedTasks.has(taskId)) {
        this.selectedTasks.add(taskId);
        changed = true;
      }
    }
    if (changed) {
      this.createElements(Array.from(this.selectedTasks), this.groupByProject);
    }
    return this.cy.elements();
  }

  selectTask(taskIds: string[]) {
    taskIds.forEach((taskId) => {
      this.selectedTasks.add(taskId);
    });
    this.createElements(Array.from(this.selectedTasks), this.groupByProject);

    return this.cy.elements();
  }

  deselectTask(taskIds: string[]) {
    taskIds.forEach((taskId) => {
      this.selectedTasks.delete(taskId);
    });
    this.createElements(Array.from(this.selectedTasks), this.groupByProject);

    return this.cy.elements();
  }

  private createElements(taskIds: string[], groupByFolder: boolean) {
    const taskElements = [];

    taskIds.forEach((taskId) => {
      const taskGraph = this.taskGraphs[taskId];

      if (taskGraph === undefined) {
        throw new Error(`Could not find task graph for ${taskId}`);
      }

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
    });

    this.cy = cytoscape({
      headless: true,
      elements: taskElements.map((element) =>
        element.getCytoscapeNodeDef(groupByFolder)
      ),
      boxSelectionEnabled: false,
    });
  }
}
