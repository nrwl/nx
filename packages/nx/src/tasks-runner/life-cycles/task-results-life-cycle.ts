import type { LifeCycle, TaskResult } from '../life-cycle';

export class TaskResultsLifeCycle implements LifeCycle {
  private taskResults = {} as Record<string, TaskResult>;

  endTasks(taskResults: TaskResult[]): void {
    for (let t of taskResults) {
      this.taskResults[t.task.id] = t;
    }
  }

  getTaskResults(): Record<string, TaskResult> {
    return this.taskResults;
  }
}
