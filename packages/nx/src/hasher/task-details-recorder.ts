import type { HashedTask } from '../native';
import { IS_WASM, TaskDetails } from '../native';
import { getDbConnection } from '../utils/db-connection';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { daemonClient } from '../daemon/client/client';

export interface TaskDetailsRecorder {
  recordTaskDetails(tasks: HashedTask[]): Promise<void>;
}

export class InProcessTaskDetailsRecorder implements TaskDetailsRecorder {
  private _taskDetails?: TaskDetails;

  private get taskDetails(): TaskDetails {
    if (!this._taskDetails) {
      this._taskDetails = new TaskDetails(getDbConnection());
    }
    return this._taskDetails;
  }

  async recordTaskDetails(tasks: HashedTask[]): Promise<void> {
    if (tasks.length === 0) return;
    this.taskDetails.recordTaskDetails(tasks);
  }
}

export class DaemonTaskDetailsRecorder implements TaskDetailsRecorder {
  async recordTaskDetails(tasks: HashedTask[]): Promise<void> {
    if (tasks.length === 0) return;
    return daemonClient.recordTaskDetails(tasks);
  }
}

let taskDetailsRecorder: TaskDetailsRecorder;

/**
 * Returns the singleton instance of TaskDetailsRecorder
 * @returns singleton instance of TaskDetailsRecorder, null if WASM is enabled
 */
export function getTaskDetails(): TaskDetailsRecorder | null {
  if (IS_WASM) {
    return null;
  }
  if (!taskDetailsRecorder) {
    taskDetailsRecorder =
      isOnDaemon() || !daemonClient.enabled()
        ? new InProcessTaskDetailsRecorder()
        : new DaemonTaskDetailsRecorder();
  }
  return taskDetailsRecorder;
}
