import { ProjectGraph, TargetDependencyConfig } from '@nrwl/devkit';
import { Task } from './tasks-runner';
import { getDependencyConfigs } from './utils';
import { performance } from 'perf_hooks';

interface TaskGraph {
  tasks: Record<string, Task>;
  dependencies: Record<string, string[]>;
}

export class TaskOrderer {
  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly defaultTargetDependencies: Record<
      string,
      TargetDependencyConfig[]
    >
  ) {}

  splitTasksIntoStages(tasks: Task[]): Task[][] {
    if (tasks.length === 0) return [];

    const stages: Task[][] = [];
    performance.mark('ordering tasks:start');
    const taskGraph = this.createTaskGraph(tasks);
    const notStagedTaskIds = new Set<string>(tasks.map((t) => t.id));
    let stageIndex = 0;

    // Loop through tasks and try to stage them. As tasks are staged, they are removed from the loop
    while (notStagedTaskIds.size > 0) {
      const currentStage = (stages[stageIndex] = []);
      for (const taskId of notStagedTaskIds) {
        let ready = true;
        for (const dependency of taskGraph.dependencies[taskId]) {
          if (notStagedTaskIds.has(dependency)) {
            // dependency has not been staged yet, this task is not ready to be staged.
            ready = false;
            break;
          }
        }

        // Some dependency still has not been staged, skip it for now, it will be processed again
        if (!ready) {
          continue;
        }

        // All the dependencies have been staged, let's stage it.
        const task = taskGraph.tasks[taskId];
        currentStage.push(task);
      }

      // Remove the entire new stage of tasks from the list
      for (const task of currentStage) {
        notStagedTaskIds.delete(task.id);
      }
      stageIndex++;
    }
    performance.mark('ordering tasks:end');
    performance.measure(
      'ordering tasks',
      'ordering tasks:start',
      'ordering tasks:end'
    );
    return stages;
  }

  private createTaskGraph(tasks: Task[]): TaskGraph {
    const graph: TaskGraph = {
      tasks: {},
      dependencies: {},
    };
    for (const task of tasks) {
      graph.tasks[task.id] = task;
      graph.dependencies[task.id] = [];
      const dependencyConfigs = getDependencyConfigs(
        task.target,
        this.defaultTargetDependencies,
        this.projectGraph
      );

      if (!dependencyConfigs) {
        continue;
      }

      const projectDependencies = new Set(
        this.projectGraph.dependencies[task.target.project].map(
          (dependency) => dependency.target
        )
      );

      for (const dependencyConfig of dependencyConfigs) {
        if (dependencyConfig.projects === 'self') {
          for (const t of tasks) {
            if (
              t.target.project === task.target.project &&
              t.target.target === dependencyConfig.target
            ) {
              graph.dependencies[task.id].push(t.id);
            }
          }
        } else if (dependencyConfig.projects === 'dependencies') {
          for (const t of tasks) {
            if (
              projectDependencies.has(t.target.project) &&
              t.target.target === dependencyConfig.target
            ) {
              graph.dependencies[task.id].push(t.id);
            }
          }
        }
      }
    }
    return graph;
  }
}
