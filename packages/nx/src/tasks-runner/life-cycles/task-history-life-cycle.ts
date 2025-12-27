import { readNxJson } from '../../config/nx-json';
import { Task } from '../../config/task-graph';
import { IS_WASM, type TaskRun as NativeTaskRun } from '../../native';
import { isNxCloudUsed } from '../../utils/nx-cloud-utils';
import { output } from '../../utils/output';
import { serializeTarget } from '../../utils/serialize-target';
import { getTaskHistory, TaskHistory } from '../../utils/task-history';
import { isTuiEnabled } from '../is-tui-enabled';
import { LifeCycle, TaskResult } from '../life-cycle';
import { LegacyTaskHistoryLifeCycle } from './task-history-life-cycle-old';

interface TaskRun extends NativeTaskRun {
  target: Task['target'];
  cacheable: boolean;
}

let tasksHistoryLifeCycle: TaskHistoryLifeCycle | LegacyTaskHistoryLifeCycle;

export function getTasksHistoryLifeCycle():
  | TaskHistoryLifeCycle
  | LegacyTaskHistoryLifeCycle {
  if (!tasksHistoryLifeCycle) {
    tasksHistoryLifeCycle = !IS_WASM
      ? new TaskHistoryLifeCycle()
      : new LegacyTaskHistoryLifeCycle();
  }

  return tasksHistoryLifeCycle;
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
    for (const taskResult of taskResults) {
      this.taskRuns.set(taskResult.task.hash, {
        hash: taskResult.task.hash,
        target: taskResult.task.target,
        code: taskResult.code,
        status: taskResult.status,
        start:
          taskResult.task.startTime ?? this.startTimings[taskResult.task.id],
        end: taskResult.task.endTime ?? Date.now(),
        cacheable: taskResult.task.cache === true,
      });
    }
  }

  async endCommand() {
    if (!this.taskHistory) {
      return;
    }
    const runs = [];

    // Only check for flaky tasks among cacheable tasks
    const cacheableHashes: string[] = [];
    const iterator = this.taskRuns.entries();
    for (const [hash, run] of iterator) {
      runs.push(run);
      if (run.cacheable) {
        cacheableHashes.push(hash);
      }
    }
    await this.taskHistory.recordTaskRuns(runs);

    this.flakyTasks =
      cacheableHashes.length > 0
        ? await this.taskHistory.getFlakyTasks(cacheableHashes)
        : [];
    // Do not directly print output when using the TUI
    if (isTuiEnabled()) {
      return;
    }
    this.printFlakyTasksMessage();
  }

  printFlakyTasksMessage() {
    if (this.flakyTasks?.length > 0) {
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
          ...(isNxCloudUsed(readNxJson())
            ? []
            : [
                '',
                `Flaky tasks can disrupt your CI pipeline. Automatically retry them with Nx Cloud. Learn more at https://nx.dev/ci/features/flaky-tasks`,
              ]),
        ],
      });
    }
  }
}
