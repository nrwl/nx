import { serializeTarget } from '../../utils/serialize-target';
import { Task } from '../../config/task-graph';
import { output } from '../../utils/output';
import {
  getHistoryForHashes,
  TaskRun,
  writeTaskRunsToHistory as writeTaskRunsToHistory,
} from '../../utils/task-history';
import { LifeCycle, TaskResult } from '../life-cycle';

export class TaskHistoryLifeCycle implements LifeCycle {
  private startTimings: Record<string, number> = {};
  private taskRuns: TaskRun[] = [];

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
    const flakyTasks: string[] = [];

    // check if any hash has different exit codes => flaky
    for (let hash in history) {
      if (
        history[hash].length > 1 &&
        history[hash].some((run) => run.code !== history[hash][0].code)
      ) {
        flakyTasks.push(
          serializeTarget(
            history[hash][0].project,
            history[hash][0].target,
            history[hash][0].configuration
          )
        );
      }
    }
    if (flakyTasks.length > 0) {
      output.warn({
        title: `Nx detected ${
          flakyTasks.length === 1 ? 'a flaky task' : ' flaky tasks'
        }`,
        bodyLines: [
          ,
          ...flakyTasks.map((t) => `  ${t}`),
          '',
          `Flaky tasks can disrupt your CI pipeline. Automatically retry them with Nx Cloud. Learn more at https://nx.dev/ci/features/flaky-tasks`,
        ],
      });
    }
  }
}
