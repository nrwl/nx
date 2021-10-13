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
      this.addTaskToGraph(task, graph);

      const dependencyConfigs = getDependencyConfigs(
        task.target,
        this.defaultTargetDependencies,
        this.projectGraph
      );

      if (!dependencyConfigs) {
        continue;
      }

      this.addTaskDependencies(task, dependencyConfigs, tasks, graph);
    }

    graph.roots = Object.keys(graph.dependencies).filter(
      (k) => graph.dependencies[k].length === 0
    );

    return graph;
  }

  private addTaskDependencies(
    task: Task,
    dependencyConfigs: TargetDependencyConfig[],
    tasks: Task[],
    graph: TaskGraph
  ) {
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
        const seen = new Set<string>();

        this.addDependencies(
          task.target.project,
          dependencyConfig.target,
          tasks,
          graph,
          task.id,
          seen
        );
      }
    }
  }

  private addDependencies(
    project: string,
    target: string,
    tasks: Task[],
    graph: TaskGraph,
    taskId: string,
    seen: Set<string>
  ) {
    seen.add(project);
    const dependencies = this.projectGraph.dependencies[project];
    if (dependencies) {
      const projectDependencies = dependencies.map(
        (dependency) => dependency.target
      );
      for (const projectDependency of projectDependencies) {
        if (seen.has(projectDependency)) {
          continue;
        }
        const dependency = this.findTask(
          { project: projectDependency, target },
          tasks
        );
        if (dependency) {
          graph.dependencies[taskId].push(dependency.id);
        } else {
          this.addDependencies(
            projectDependency,
            target,
            tasks,
            graph,
            taskId,
            seen
          );
        }
      }
    }
  }

  private findTask(
    { project, target }: { project: string; target: string },
    tasks: Task[]
  ): Task {
    return tasks.find(
      (t) => t.target.project === project && t.target.target === target
    );
  }

  private addTaskToGraph(task: Task, graph: TaskGraph) {
    graph.tasks[task.id] = task;
    graph.dependencies[task.id] = [];
  }
}
