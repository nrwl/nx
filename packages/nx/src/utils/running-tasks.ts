import {
  IS_WASM,
  RunningTasksService as NxRunningTasksService,
} from '../native';
import { getDbConnection } from './db-connection';
import { shouldDelegateDbToDaemon, isOnDaemon } from '../daemon/is-on-daemon';
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
    if (
      isOnDaemon() ||
      !daemonClient.enabled() ||
      !shouldDelegateDbToDaemon()
    ) {
      return this.service.getRunningTasks(ids);
    }
    return daemonClient.getRunningTasks(ids);
  }

  addRunningTask(taskId: string): void | Promise<void> {
    if (
      isOnDaemon() ||
      !daemonClient.enabled() ||
      !shouldDelegateDbToDaemon()
    ) {
      return this.service.addRunningTask(taskId);
    }
    return daemonClient.addRunningTask(taskId);
  }

  removeRunningTask(taskId: string): void | Promise<void> {
    if (
      isOnDaemon() ||
      !daemonClient.enabled() ||
      !shouldDelegateDbToDaemon()
    ) {
      return this.service.removeRunningTask(taskId);
    }
    return daemonClient.removeRunningTask(taskId);
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
