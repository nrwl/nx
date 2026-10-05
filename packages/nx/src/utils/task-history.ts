import { IS_WASM, NxTaskHistory, TaskRun, TaskTarget } from '../native';
import { getDbConnection } from './db-connection';

export class TaskHistory {
  // TaskDetails records hashes on this process's connection. Keep history on
  // that same connection: a daemon may have frozen a different cache/database
  // namespace before a later client supplied its workspace-data overrides.
  taskHistory = new NxTaskHistory(getDbConnection());

  /**
   * This function returns estimated timings per task
   * @param targets
   * @returns a map where key is task id (project:target:configuration), value is average time of historical runs
   */
  async getEstimatedTaskTimings(
    targets: TaskTarget[]
  ): Promise<Record<string, number>> {
    return this.taskHistory.getEstimatedTaskTimings(targets);
  }

  async getFlakyTasks(hashes: string[]) {
    return this.taskHistory.getFlakyTasks(hashes);
  }

  async recordTaskRuns(taskRuns: TaskRun[]) {
    return this.taskHistory.recordTaskRuns(taskRuns);
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
