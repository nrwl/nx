import { performance } from 'perf_hooks';
import { daemonClient } from '../daemon/client/client';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { IS_WASM, NxTaskHistory, TaskRun, TaskTarget } from '../native';
import { getDbConnection } from './db-connection';

export class TaskHistory {
  private _taskHistory?: NxTaskHistory;

  private get taskHistory(): NxTaskHistory {
    if (!this._taskHistory) {
      this._taskHistory = new NxTaskHistory(getDbConnection());
    }
    return this._taskHistory;
  }

  /**
   * This function returns estimated timings per task
   * @param targets
   * @returns a map where key is task id (project:target:configuration), value is average time of historical runs
   */
  async getEstimatedTaskTimings(
    targets: TaskTarget[]
  ): Promise<Record<string, number>> {
    performance.mark('db:taskHistory.getEstimatedTimings:start');

    let result: Record<string, number>;
    if (isOnDaemon() || !daemonClient.enabled()) {
      result = this.taskHistory.getEstimatedTaskTimings(targets);
    } else {
      result = await daemonClient.getEstimatedTaskTimings(targets);
    }

    performance.mark('db:taskHistory.getEstimatedTimings:end');
    performance.measure(
      'db:taskHistory.getEstimatedTimings',
      'db:taskHistory.getEstimatedTimings:start',
      'db:taskHistory.getEstimatedTimings:end'
    );

    return result;
  }

  async getFlakyTasks(hashes: string[]) {
    performance.mark('db:taskHistory.getFlakyTasks:start');

    let result: string[];
    if (isOnDaemon() || !daemonClient.enabled()) {
      result = this.taskHistory.getFlakyTasks(hashes);
    } else {
      result = await daemonClient.getFlakyTasks(hashes);
    }

    performance.mark('db:taskHistory.getFlakyTasks:end');
    performance.measure(
      'db:taskHistory.getFlakyTasks',
      'db:taskHistory.getFlakyTasks:start',
      'db:taskHistory.getFlakyTasks:end'
    );

    return result;
  }

  async recordTaskRuns(taskRuns: TaskRun[]) {
    performance.mark('db:taskHistory.recordTaskRuns:start');

    if (isOnDaemon() || !daemonClient.enabled()) {
      this.taskHistory.recordTaskRuns(taskRuns);
    } else {
      await daemonClient.recordTaskRuns(taskRuns);
    }

    performance.mark('db:taskHistory.recordTaskRuns:end');
    performance.measure(
      'db:taskHistory.recordTaskRuns',
      'db:taskHistory.recordTaskRuns:start',
      'db:taskHistory.recordTaskRuns:end'
    );
  }
}

let taskHistory: TaskHistory;

/**
 * This function returns the singleton instance of TaskHistory
 * @returns singleton instance of TaskHistory, null if database is disabled or WASM is enabled
 */
export function getTaskHistory(): TaskHistory | null {
  if (IS_WASM) {
    return null;
  }

  if (!taskHistory) {
    taskHistory = new TaskHistory();
  }
  return taskHistory;
}
