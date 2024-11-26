import { daemonClient } from '../daemon/client/client';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { IS_WASM, NxTaskHistory, TaskRun, TaskTarget } from '../native';
import { getDbConnection } from './db-connection';

export class TaskHistory {
  taskHistory = new NxTaskHistory(getDbConnection());

  /**
   * This function returns estimated timings per task
   * @param targets
   * @returns a map where key is task id (project:target:configuration), value is average time of historical runs
   */
  async getEstimatedTaskTimings(
    targets: TaskTarget[]
  ): Promise<Record<string, number>> {
    if (isOnDaemon() || !daemonClient.enabled()) {
      return this.taskHistory.getEstimatedTaskTimings(targets);
    }
    return await daemonClient.getEstimatedTaskTimings(targets);
  }

  async getFlakyTasks(hashes: string[]) {
    if (isOnDaemon() || !daemonClient.enabled()) {
      return this.taskHistory.getFlakyTasks(hashes);
    }
    return await daemonClient.getFlakyTasks(hashes);
  }

  async recordTaskRuns(taskRuns: TaskRun[]) {
    if (isOnDaemon() || !daemonClient.enabled()) {
      return this.taskHistory.recordTaskRuns(taskRuns);
    }
    return daemonClient.recordTaskRuns(taskRuns);
  }
}

let taskHistory: TaskHistory;

/**
 * This function returns the singleton instance of TaskHistory
 * @returns singleton instance of TaskHistory, null if database is disabled or WASM is not enabled
 */
export function getTaskHistory(): TaskHistory | null {
  if (process.env.NX_DISABLE_DB === 'true' || !IS_WASM) {
    return null;
  }

  if (!taskHistory) {
    taskHistory = new TaskHistory();
  }
  return taskHistory;
}
