import { Task } from '../../config/task-graph';
import { IS_WASM, type TaskRun as NativeTaskRun } from '../../native';
import { output } from '../../utils/output';
import { serializeTarget } from '../../utils/serialize-target';
import { getTaskHistory, TaskHistory } from '../../utils/task-history';
import { isTuiEnabled } from '../is-tui-enabled';
import { LifeCycle, TaskResult } from '../life-cycle';
import { LegacyTaskHistoryLifeCycle } from './task-history-life-cycle-old';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { readNxJson } from '../../config/nx-json';

interface TaskRun extends NativeTaskRun {
  target: Task['target'];
}

let tasksHistoryLifeCycle: TaskHistoryLifeCycle | LegacyTaskHistoryLifeCycle;

export function getTasksHistoryLifeCycle():
  | TaskHistoryLifeCycle
  | LegacyTaskHistoryLifeCycle
  | null {
  if (!isNxCloudUsed(readNxJson())) {
    if (!tasksHistoryLifeCycle) {
      tasksHistoryLifeCycle =
        process.env.NX_DISABLE_DB !== 'true' && !IS_WASM
          ? new TaskHistoryLifeCycle()
          : new LegacyTaskHistoryLifeCycle();
    }
    return tasksHistoryLifeCycle;
  }
  return null;
}

export class TaskHistoryLifeCycle implements LifeCycle {
  private startTimings: Record<string, number> = {};
  private taskRuns = new Map<string, TaskRun>();
  private taskHistory: TaskHistory | null = getTaskHistory();
  private flakyTasks: string[];

  constructor() {
    if (tasksHistoryLifeCycle) {
      throw new Error(
        'TaskHistoryLifeCycle is a singleton and should not be instantiated multiple times'
      );
    }
    tasksHistoryLifeCycle = this;
  }

  startTasks(tasks: Task[]): void {
    for (let task of tasks) {
      this.startTimings[task.id] = new Date().getTime();
    }
  }

  async endTasks(taskResults: TaskResult[]) {
    taskResults
      .map((taskResult) => ({
        hash: taskResult.task.hash,
        target: taskResult.task.target,
        code: taskResult.code,
        status: taskResult.status,
        start:
          taskResult.task.startTime ?? this.startTimings[taskResult.task.id],
        end: taskResult.task.endTime ?? Date.now(),
      }))
      .forEach((taskRun) => {
        this.taskRuns.set(taskRun.hash, taskRun);
      });
  }

  async endCommand() {
    const entries = Array.from(this.taskRuns);
    if (!this.taskHistory) {
      return;
    }
    await this.taskHistory.recordTaskRuns(entries.map(([_, v]) => v));
    this.flakyTasks = await this.taskHistory.getFlakyTasks(
      entries.map(([hash]) => hash)
    );
    // Do not directly print output when using the TUI
    if (isTuiEnabled()) {
      return;
    }
    this.printFlakyTasksMessage();
  }

  printFlakyTasksMessage() {
    if (this.flakyTasks.length > 0) {
      output.warn({
        title: `Nx detected ${
          this.flakyTasks.length === 1 ? 'a flaky task' : ' flaky tasks'
        }`,
        bodyLines: [
          ,
          ...this.flakyTasks.map((hash) => {
            const taskRun = this.taskRuns.get(hash);
            return `  ${serializeTarget(
              taskRun.target.project,
              taskRun.target.target,
              taskRun.target.configuration
            )}`;
          }),
          '',
          `Flaky tasks can disrupt your CI pipeline. Automatically retry them with Nx Cloud. Learn more at https://nx.dev/ci/features/flaky-tasks`,
        ],
      });
    }
  }
}
