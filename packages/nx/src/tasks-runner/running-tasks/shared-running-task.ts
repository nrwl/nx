import { RunningTask } from './running-task';
import { RunningTasksService } from '../../native';

export class SharedRunningTask implements RunningTask {
  private exitCallbacks: ((code: number) => void)[] = [];

  constructor(
    private runningTasksService: RunningTasksService,
    taskId: string
  ) {
    this.waitForTaskToFinish(taskId).then(() => {
      // notify exit callbacks
      this.exitCallbacks.forEach((cb) => cb(0));
    });
  }

  async getResults(): Promise<{ code: number; terminalOutput: string }> {
    throw new Error('Results cannot be retrieved from a shared task');
  }

  kill(): void {
    this.exitCallbacks.forEach((cb) => cb(0));
  }

  onExit(cb: (code: number) => void): void {
    this.exitCallbacks.push(cb);
  }

  private async waitForTaskToFinish(taskId: string) {
    console.log(`Waiting for ${taskId} in another nx process`);
    // wait for the running task to finish
    do {
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (this.runningTasksService.getRunningTasks([taskId]).length);
  }
}
