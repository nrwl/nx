import { ProjectGraph } from '../core/project-graph';
import { Task } from './tasks-runner';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { getDependencyConfigs } from './utils';

interface TaskGraph {
  tasks: Record<string, Task>;
  dependencies: Record<string, string[]>;
}

export class TaskOrderer {
  constructor(
    private readonly options: DefaultTasksRunnerOptions,
    private readonly target: string,
    private readonly projectGraph: ProjectGraph
  ) {}

  splitTasksIntoStages(tasks: Task[]) {
    if (
      (this.options.strictlyOrderedTargets || ['build']).indexOf(
        this.target
      ) === -1
    )
      return [tasks];
    if (tasks.length === 0) return [];
    const stages: Task[][] = [];
    const taskGraph = this.createTaskGraph(tasks);
    this.topologicallySortTasks(tasks).forEach((t) => {
      const earliestStage = this.findEarliestStage(t, stages, taskGraph);
      if (earliestStage) {
        earliestStage.push(t);
      } else {
        stages.push([t]);
      }
    });
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
        this.projectGraph
      );
      const projectDependencies = new Set(
        this.projectGraph.dependencies[task.target.project].map(
          (dependency) => dependency.target
        )
      );

      if (!dependencyConfigs) {
        for (const t of tasks) {
          if (projectDependencies.has(t.target.project)) {
            graph.dependencies[task.id].push(t.id);
          }
        }
      } else {
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
    }
    return graph;
  }

  private findEarliestStage(
    task: Task,
    stages: Task[][],
    taskGraph: TaskGraph
  ) {
    const unseenDependencies = new Set(taskGraph.dependencies[task.id]);
    for (const stage of stages) {
      if (unseenDependencies.size === 0) {
        return stage;
      }
      for (const taskInStage of stage) {
        unseenDependencies.delete(taskInStage.id);
      }
    }
  }

  private topologicallySortTasks(tasks: Task[]) {
    const visited: { [k: string]: boolean } = {};
    const sortedProjects: string[] = [];

    const visitNode = (id: string) => {
      if (visited[id]) return;
      visited[id] = true;
      this.projectGraph.dependencies[id].forEach((d) => {
        visitNode(d.target);
      });
      sortedProjects.push(id);
    };
    tasks.forEach((t) => visitNode(t.target.project));

    return tasks.sort((a, b) => {
      if (a.target.project === b.target.project) {
        return this.projectGraph.nodes[a.target.project].data.targets.dependsOn
          ?.target === a.target.target
          ? -1
          : 1;
      } else {
        return (
          sortedProjects.indexOf(a.target.project) -
          sortedProjects.indexOf(b.target.project)
        );
      }
    });
  }
}
