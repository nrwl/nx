import { daemonClient } from '../../daemon/client/client';
import { output } from '../../utils/output';

export interface ShowRunningTasksOptions {
  json?: boolean;
  task?: string;
}

export async function showRunningTasksHandler(
  args: ShowRunningTasksOptions,
  client = daemonClient
): Promise<void> {
  const rawRunningTasks = await client.getRunningTasks();
  const runningTasks = JSON.parse(rawRunningTasks);

  if (args.task) {
    // Find which process has this task
    let targetPid: number | null = null;
    for (const run of runningTasks) {
      if (run.tasks[args.task]) {
        targetPid = run.pid;
        break;
      }
    }

    if (targetPid === null) {
      output.error({
        title: `Task '${args.task}' is not currently running`,
        bodyLines: runningTasks.length
          ? [
              'Currently running tasks:',
              ...runningTasks.flatMap((run) =>
                Object.keys(run.tasks).map((t) => `  - ${t}`)
              ),
            ]
          : ['No tasks are currently running.'],
      });
      process.exit(1);
    }

    const rawOutput = await client.getRunningTaskOutput(targetPid, args.task);
    const taskOutput = JSON.parse(rawOutput);
    process.stdout.write(taskOutput);
    if (taskOutput && !taskOutput.endsWith('\n')) {
      process.stdout.write('\n');
    }
  } else {
    process.stdout.write(JSON.stringify(runningTasks, null, 2));
    process.stdout.write('\n');
  }
}
