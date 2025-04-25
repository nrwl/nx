import { Task } from '../../config/task-graph';
import {
  getHistoryForHashes,
  TaskRun,
  writeTaskRunsToHistory,
} from '../../utils/legacy-task-history';
import { output } from '../../utils/output';
import { serializeTarget } from '../../utils/serialize-target';
import { isTuiEnabled } from '../is-tui-enabled';
import { LifeCycle, TaskResult } from '../life-cycle';

export class LegacyTaskHistoryLifeCycle implements LifeCycle {
  private startTimings: Record<string, number> = {};
  private taskRuns: TaskRun[] = [];
  private flakyTasks: string[];

  startTasks(tasks: Task[]): void {
    for (let task of tasks) {
      this.startTimings[task.id] = new Date().getTime();
    }
  }

  async endTasks(taskResults: TaskResult[]) {
    const taskRuns: TaskRun[] = taskResults.map((taskResult) => ({
      project: taskResult.task.target.project,
      target: taskResult.task.target.target,
      configuration: taskResult.task.target.configuration,
      hash: taskResult.task.hash,
      code: taskResult.code.toString(),
      status: taskResult.status,
      start: (
        taskResult.task.startTime ?? this.startTimings[taskResult.task.id]
      ).toString(),
      end: (taskResult.task.endTime ?? new Date().getTime()).toString(),
    }));
    this.taskRuns.push(...taskRuns);
  }

  async endCommand() {
    await writeTaskRunsToHistory(this.taskRuns);
    const history = await getHistoryForHashes(this.taskRuns.map((t) => t.hash));
    this.flakyTasks = [];

    // check if any hash has different exit codes => flaky
    for (let hash in history) {
      if (
        history[hash].length > 1 &&
        history[hash].some((run) => run.code !== history[hash][0].code)
      ) {
        this.flakyTasks.push(
          serializeTarget(
            history[hash][0].project,
            history[hash][0].target,
            history[hash][0].configuration
          )
        );
      }
    }
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
          ...this.flakyTasks.map((t) => `  ${t}`),
          '',
          `Flaky tasks can disrupt your CI pipeline. Automatically retry them with Nx Cloud. Learn more at https://nx.dev/ci/features/flaky-tasks`,
        ],
      });
    }
  }
}
