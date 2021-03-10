import { ProjectGraph } from '../core/project-graph';
import { Task } from './tasks-runner';
import { DefaultTasksRunnerOptions } from './default-tasks-runner';
import { getPath } from '../utils/graph-utils';

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
    const res = [];
    this.topologicallySortTasks(tasks).forEach((t) => {
      const stageWithNoDeps = res.find(
        (tasksInStage) => !this.taskDependsOnDeps(t, tasksInStage)
      );
      if (stageWithNoDeps) {
        stageWithNoDeps.push(t);
      } else {
        res.push([t]);
      }
    });
    return res;
  }

  private taskDependsOnDeps(task: Task, deps: Task[]) {
    return !!deps.find(
      (dep) =>
        getPath(this.projectGraph, task.target.project, dep.target.project)
          .length > 0
    );
  }

  private topologicallySortTasks(tasks: Task[]) {
    const visited: { [k: string]: boolean } = {};
    const sorted = [];

    const visitNode = (id: string) => {
      if (visited[id]) return;
      visited[id] = true;
      this.projectGraph.dependencies[id].forEach((d) => {
        visitNode(d.target);
      });
      sorted.push(id);
    };
    tasks.forEach((t) => visitNode(t.target.project));
    const sortedTasks = [...tasks];
    sortedTasks.sort((a, b) =>
      sorted.indexOf(a.target.project) > sorted.indexOf(b.target.project)
        ? 1
        : -1
    );
    return sortedTasks;
  }
}
