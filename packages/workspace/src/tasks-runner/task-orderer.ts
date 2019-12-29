import { ProjectGraph } from '../core/project-graph';
import { Task } from './tasks-runner';

export class TaskOrderer {
  constructor(
    private readonly target: string,
    private readonly projectGraph: ProjectGraph
  ) {}

  splitTasksIntoStages(tasks: Task[]) {
    if (this.target !== 'build') return [tasks];
    if (tasks.length === 0) return [];
    const res = [];
    this.topologicallySortTasks(tasks).forEach(t => {
      const stageWithNoDeps = res.find(
        tasksInStage => !this.taskDependsOnDeps(t, tasksInStage)
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
    const g = this.projectGraph;

    function hasDep(source: string, target: string, visitedProjects: string[]) {
      if (!g.dependencies[source]) {
        return false;
      }

      if (g.dependencies[source].find(d => d.target === target)) {
        return true;
      }

      return !!g.dependencies[source].find(r => {
        if (visitedProjects.indexOf(r.target) > -1) return null;
        return hasDep(r.target, target, [...visitedProjects, r.target]);
      });
    }

    return !!deps.find(dep =>
      hasDep(task.target.project, dep.target.project, [])
    );
  }

  private topologicallySortTasks(tasks: Task[]) {
    const sortedTasks = [...tasks];
    sortedTasks.sort((a, b) => {
      if (this.taskDependsOnDeps(a, [b])) return 1;
      if (this.taskDependsOnDeps(b, [a])) return -1;
      return 0;
    });
    return sortedTasks;
  }
}
