import { performance } from 'perf_hooks';
import type { HashedTask } from '../native';
import { IS_WASM, TaskDetails } from '../native';
import { getDbConnection } from '../utils/db-connection';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { daemonClient } from '../daemon/client/client';

class TaskDetailsRecorder {
  private _taskDetails?: TaskDetails;

  private get taskDetails(): TaskDetails {
    if (!this._taskDetails) {
      this._taskDetails = new TaskDetails(getDbConnection());
    }
    return this._taskDetails;
  }

  async recordTaskDetails(tasks: HashedTask[]): Promise<void> {
    if (tasks.length === 0) return;

    performance.mark('db:taskDetails.record:start');

    if (isOnDaemon() || !daemonClient.enabled()) {
      this.taskDetails.recordTaskDetails(tasks);
    } else {
      await daemonClient.recordTaskDetails(tasks);
    }

    performance.mark('db:taskDetails.record:end');
    performance.measure(
      'db:taskDetails.record',
      'db:taskDetails.record:start',
      'db:taskDetails.record:end'
    );
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
    taskDetailsRecorder = new TaskDetailsRecorder();
  }
  return taskDetailsRecorder;
}
