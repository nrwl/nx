import { Task } from 'nx/src/shared/tasks';
import { LifeCycle } from '../life-cycle';
import { TaskStatus } from '../tasks-runner';

export class TaskTimingsLifeCycle implements LifeCycle {
  private timings: {
    [target: string]: {
      start: number;
      end: number;
    };
  } = {};

  startTasks(tasks: Task[]): void {
    for (let t of tasks) {
      this.timings[`${t.target.project}:${t.target.target}`] = {
        start: new Date().getTime(),
        end: undefined,
      };
    }
  }

  endTasks(
    taskResults: Array<{ task: Task; status: TaskStatus; code: number }>
  ): void {
    for (let tr of taskResults) {
      this.timings[`${tr.task.target.project}:${tr.task.target.target}`].end =
        new Date().getTime();
    }
  }

  endCommand(): void {
    console.log('Task Execution Timings:');
    const timings = {};
    Object.keys(this.timings).forEach((p) => {
      const t = this.timings[p];
      timings[p] = t.end ? t.end - t.start : null;
    });
    console.log(JSON.stringify(timings, null, 2));
  }
}
