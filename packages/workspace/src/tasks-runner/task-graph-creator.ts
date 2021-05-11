import type {
  ProjectGraph,
  TargetDependencyConfig,
  Task,
  TaskGraph,
} from '@nrwl/devkit';
import { getDependencyConfigs } from './utils';

export class TaskGraphCreator {
  constructor(
    private readonly projectGraph: ProjectGraph,
    private readonly defaultTargetDependencies: Record<
      string,
      TargetDependencyConfig[]
    >
  ) {}

  createTaskGraph(tasks: Task[]): TaskGraph {
    const graph: TaskGraph = {
      roots: [],
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

    graph.roots = Object.keys(graph.dependencies).filter(
      (k) => graph.dependencies[k].length === 0
    );

    return graph;
  }
}
