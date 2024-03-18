import { Task } from '../../config/task-graph';
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
      this.timings[t.id] = {
        start: new Date().getTime(),
        end: undefined,
      };
    }
  }

  endTasks(
    taskResults: Array<{
      task: Task;
      status: TaskStatus;
      code: number;
    }>
  ): void {
    for (let tr of taskResults) {
      if (tr.task.startTime) {
        this.timings[tr.task.id].start = tr.task.startTime;
      }
      if (tr.task.endTime) {
        this.timings[tr.task.id].end = tr.task.endTime;
      } else {
        this.timings[tr.task.id].end = new Date().getTime();
      }
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
