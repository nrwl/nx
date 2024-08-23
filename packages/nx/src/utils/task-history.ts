import { daemonClient } from '../daemon/client/client';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { NxTaskHistory, TaskRun } from '../native';
import { getDbConnection } from './db-connection';

export class TaskHistory {
  taskHistory = new NxTaskHistory(getDbConnection());

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
