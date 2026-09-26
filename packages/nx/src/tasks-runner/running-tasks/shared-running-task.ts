import { RunningTask } from './running-task';
import { RunningTasksService } from '../../native';

export class SharedRunningTask implements RunningTask {
  private exitCallbacks: ((code: number) => void)[] = [];
  private detached = false;

  constructor(
    private runningTasksService: RunningTasksService,
    taskId: string
  ) {
    this.waitForTaskToFinish(taskId).then(() => {
      if (this.detached) {
        return;
      }
      // notify exit callbacks
      this.exitCallbacks.forEach((cb) => cb(0));
    });
  }

  async getResults(): Promise<{ code: number; terminalOutput: string }> {
    throw new Error('Results cannot be retrieved from a shared task');
  }

  // Detaches from the shared task; the owning process keeps running it.
  kill(): void {
    if (this.detached) {
      return;
    }
    this.detached = true;
    this.exitCallbacks.forEach((cb) => cb(0));
    this.exitCallbacks = [];
  }

  onExit(cb: (code: number) => void): void {
    this.exitCallbacks.push(cb);
  }

  private async waitForTaskToFinish(taskId: string) {
    const runningTasks = this.runningTasksService.getRunningTasks([taskId]);
    const context = runningTasks[0];
    if (context) {
      console.log(
        `Waiting for ${taskId} in another nx process (pid: ${context.pid}, cwd: ${context.cwd})`
      );
    } else {
      console.log(`Waiting for ${taskId} in another nx process`);
    }
    // wait for the running task to finish
    do {
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (
      !this.detached &&
      this.runningTasksService.getRunningTasks([taskId]).length
    );
  }
}
