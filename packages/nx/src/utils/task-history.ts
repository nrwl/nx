import { daemonClient } from '../daemon/client/client';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { IS_WASM, NxTaskHistory, TaskRun, TaskTarget } from '../native';
import { getDbConnection } from './db-connection';

export interface TaskHistory {
  /**
   * This function returns estimated timings per task
   * @param targets
   * @returns a map where key is task id (project:target:configuration), value is average time of historical runs
   */
  getEstimatedTaskTimings(
    targets: TaskTarget[]
  ): Promise<Record<string, number>>;
  getFlakyTasks(hashes: string[]): Promise<string[]>;
  recordTaskRuns(taskRuns: TaskRun[]): Promise<void>;
}

export class InProcessTaskHistory implements TaskHistory {
  private _taskHistory?: NxTaskHistory;

  private get taskHistory(): NxTaskHistory {
    if (!this._taskHistory) {
      this._taskHistory = new NxTaskHistory(getDbConnection());
    }
    return this._taskHistory;
  }

  async getEstimatedTaskTimings(
    targets: TaskTarget[]
  ): Promise<Record<string, number>> {
    return this.taskHistory.getEstimatedTaskTimings(targets);
  }

  async getFlakyTasks(hashes: string[]): Promise<string[]> {
    return this.taskHistory.getFlakyTasks(hashes);
  }

  async recordTaskRuns(taskRuns: TaskRun[]): Promise<void> {
    this.taskHistory.recordTaskRuns(taskRuns);
  }
}

export class DaemonTaskHistory implements TaskHistory {
  async getEstimatedTaskTimings(
    targets: TaskTarget[]
  ): Promise<Record<string, number>> {
    return daemonClient.getEstimatedTaskTimings(targets);
  }

  async getFlakyTasks(hashes: string[]): Promise<string[]> {
    return daemonClient.getFlakyTasks(hashes);
  }

  async recordTaskRuns(taskRuns: TaskRun[]): Promise<void> {
    return daemonClient.recordTaskRuns(taskRuns);
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
    taskHistory =
      isOnDaemon() || !daemonClient.enabled()
        ? new InProcessTaskHistory()
        : new DaemonTaskHistory();
  }
  return taskHistory;
}
