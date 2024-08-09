import { serializeTarget } from '../../utils/serialize-target';
import { Task } from '../../config/task-graph';
import { output } from '../../utils/output';
import { TaskHistory } from '../../utils/task-history';
import { LifeCycle, TaskResult } from '../life-cycle';
import type { TaskRun as NativeTaskRun } from '../../native';

interface TaskRun extends NativeTaskRun {
  target: Task['target'];
}

export class TaskHistoryLifeCycle implements LifeCycle {
  private startTimings: Record<string, number> = {};
  private taskRuns = new Map<string, TaskRun>();
  private taskHistory = new TaskHistory();

  startTasks(tasks: Task[]): void {
    for (let task of tasks) {
      this.startTimings[task.id] = new Date().getTime();
    }
  }

  async endTasks(taskResults: TaskResult[]) {
    taskResults
      .map((taskResult) => ({
        hash: taskResult.task.hash,
        target: taskResult.task.target,
        code: taskResult.code,
        status: taskResult.status,
        start:
          taskResult.task.startTime ?? this.startTimings[taskResult.task.id],
        end: taskResult.task.endTime ?? Date.now(),
      }))
      .forEach((taskRun) => {
        this.taskRuns.set(taskRun.hash, taskRun);
      });
  }

  async endCommand() {
    const entries = Array.from(this.taskRuns);
    await this.taskHistory.recordTaskRuns(entries.map(([_, v]) => v));
    const flakyTasks = await this.taskHistory.getFlakyTasks(
      entries.map(([hash]) => hash)
    );
    if (flakyTasks.length > 0) {
      output.warn({
        title: `Nx detected ${
          flakyTasks.length === 1 ? 'a flaky task' : ' flaky tasks'
        }`,
        bodyLines: [
          ,
          ...flakyTasks.map((hash) => {
            const taskRun = this.taskRuns.get(hash);
            return `  ${serializeTarget(
              taskRun.target.project,
              taskRun.target.target,
              taskRun.target.configuration
            )}`;
          }),
          '',
          `Flaky tasks can disrupt your CI pipeline. Automatically retry them with Nx Cloud. Learn more at https://nx.dev/ci/features/flaky-tasks`,
        ],
      });
    }
  }
}
