import { performance } from 'perf_hooks';
import {
  IS_WASM,
  RunningTasksService as NxRunningTasksService,
} from '../native';
import { getDbConnection } from './db-connection';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { daemonClient } from '../daemon/client/client';

export class RunningTasksService {
  private _service?: NxRunningTasksService;

  private get service(): NxRunningTasksService {
    if (!this._service) {
      this._service = new NxRunningTasksService(getDbConnection());
    }
    return this._service;
  }

  getRunningTasks(ids: string[]): string[] | Promise<string[]> {
    performance.mark('db:runningTasks.get:start');

    if (isOnDaemon() || !daemonClient.enabled()) {
      const result = this.service.getRunningTasks(ids);
      performance.mark('db:runningTasks.get:end');
      performance.measure(
        'db:runningTasks.get',
        'db:runningTasks.get:start',
        'db:runningTasks.get:end'
      );
      return result;
    }

    return daemonClient.getRunningTasks(ids).then((result) => {
      performance.mark('db:runningTasks.get:end');
      performance.measure(
        'db:runningTasks.get',
        'db:runningTasks.get:start',
        'db:runningTasks.get:end'
      );
      return result;
    });
  }

  addRunningTask(taskId: string): void | Promise<void> {
    performance.mark('db:runningTasks.add:start');

    if (isOnDaemon() || !daemonClient.enabled()) {
      const result = this.service.addRunningTask(taskId);
      performance.mark('db:runningTasks.add:end');
      performance.measure(
        'db:runningTasks.add',
        'db:runningTasks.add:start',
        'db:runningTasks.add:end'
      );
      return result;
    }

    return daemonClient.addRunningTask(taskId).then((result) => {
      performance.mark('db:runningTasks.add:end');
      performance.measure(
        'db:runningTasks.add',
        'db:runningTasks.add:start',
        'db:runningTasks.add:end'
      );
      return result;
    });
  }

  removeRunningTask(taskId: string): void | Promise<void> {
    performance.mark('db:runningTasks.remove:start');

    if (isOnDaemon() || !daemonClient.enabled()) {
      const result = this.service.removeRunningTask(taskId);
      performance.mark('db:runningTasks.remove:end');
      performance.measure(
        'db:runningTasks.remove',
        'db:runningTasks.remove:start',
        'db:runningTasks.remove:end'
      );
      return result;
    }

    return daemonClient.removeRunningTask(taskId).then((result) => {
      performance.mark('db:runningTasks.remove:end');
      performance.measure(
        'db:runningTasks.remove',
        'db:runningTasks.remove:start',
        'db:runningTasks.remove:end'
      );
      return result;
    });
  }
}

let runningTasksService: RunningTasksService;

/**
 * Returns the singleton instance of RunningTasksService
 * @returns singleton instance of RunningTasksService, null if WASM is enabled
 */
export function getRunningTasksService(): RunningTasksService | null {
  if (IS_WASM) {
    return null;
  }
  if (!runningTasksService) {
    runningTasksService = new RunningTasksService();
  }
  return runningTasksService;
}
