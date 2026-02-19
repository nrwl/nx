import {
  IS_WASM,
  RunningTasksService as NxRunningTasksService,
} from '../native';
import { getDbConnection } from './db-connection';
import { isOnDaemon } from '../daemon/is-on-daemon';
import { daemonClient } from '../daemon/client/client';

export interface RunningTasksService {
  getRunningTasks(ids: string[]): Promise<string[]>;
  addRunningTask(taskId: string): Promise<void>;
  removeRunningTask(taskId: string): Promise<void>;
}

export class InProcessRunningTasksService implements RunningTasksService {
  private _service?: NxRunningTasksService;

  private get service(): NxRunningTasksService {
    if (!this._service) {
      this._service = new NxRunningTasksService(getDbConnection());
    }
    return this._service;
  }

  async getRunningTasks(ids: string[]): Promise<string[]> {
    return this.service.getRunningTasks(ids);
  }

  async addRunningTask(taskId: string): Promise<void> {
    this.service.addRunningTask(taskId);
  }

  async removeRunningTask(taskId: string): Promise<void> {
    this.service.removeRunningTask(taskId);
  }
}

export class DaemonRunningTasksService implements RunningTasksService {
  async getRunningTasks(ids: string[]): Promise<string[]> {
    return daemonClient.getRunningTasks(ids);
  }

  async addRunningTask(taskId: string): Promise<void> {
    return daemonClient.addRunningTask(taskId);
  }

  async removeRunningTask(taskId: string): Promise<void> {
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
    runningTasksService =
      isOnDaemon() || !daemonClient.enabled()
        ? new InProcessRunningTasksService()
        : new DaemonRunningTasksService();
  }
  return runningTasksService;
}
