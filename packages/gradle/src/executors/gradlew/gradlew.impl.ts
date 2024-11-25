import { ExecutorContext, TaskGraph } from '@nx/devkit';
import runCommandsImpl, {
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';
import { BatchResults } from 'nx/src/tasks-runner/batch/batch-messages';

export async function graldewExecutor(
  options: RunCommandsOptions,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  const results = await runCommandsImpl(options, context);
  return { success: results.success };
}

export default graldewExecutor;

export async function batchGradlew(
  taskGraph: TaskGraph,
  inputs: Record<string, RunCommandsOptions>,
  overrides: RunCommandsOptions,
  context: ExecutorContext
): Promise<BatchResults> {
  const regex = /[./\\]*gradlew[\w.-]*/;

  let gradlewCommand: string | undefined;
  const roots = taskGraph.roots;
  const tasksRan = [];
  const results: BatchResults = {};

  const gradlewTasks = roots.flatMap((task) => {
    const gradlewTask = inputs[task].command;
    if (typeof gradlewTask !== 'string') return [];

    const match = gradlewTask.match(regex);
    if (!match) return [];
    results[task] = { success: false, terminalOutput: '' };

    tasksRan.push(task);

    gradlewCommand = match[0]; // Store the first found gradlewCommand
    return gradlewTask.replace(gradlewCommand, '').trim();
  });

  if (!tasksRan.length) {
    return results;
  }

  const startTime = Date.now();
  const { success, terminalOutput } = await runCommandsImpl(
    {
      command: `${gradlewCommand} ${gradlewTasks.join(' ')} --parallel`,
      __unparsed__: [],
      ...(overrides ?? {}),
      ...(inputs[tasksRan[0]].options ?? {}),
    },
    context
  );
  const endTime = Date.now();

  tasksRan.forEach((task) => {
    results[task] = {
      success,
      terminalOutput,
      startTime,
      endTime,
    };
  });

  return results;
}
