import {
  ExecutorContext,
  output,
  ProjectGraphProjectNode,
  TaskGraph,
  workspaceRoot,
} from '@nx/devkit';
import { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';
import { TaskResult } from 'nx/src/config/misc-interfaces';
import { GradleExecutorSchema } from './schema';
import {
  findGradlewFile,
  getCustomGradleExecutableDirectoryFromPlugin,
} from '../../utils/exec-gradle';
import { dirname, join } from 'path';
import { spawn } from 'child_process';
import { createInterface } from 'readline';
import {
  getAllDependsOnFromTaskGraph,
  getExcludeTasksFromTaskGraph,
} from './get-exclude-task';

export const batchRunnerPath = join(
  __dirname,
  '../../../batch-runner/build/libs/gradle-batch-runner-all.jar'
);

export default async function* gradleBatch(
  taskGraph: TaskGraph,
  inputs: Record<string, GradleExecutorSchema>,
  overrides: RunCommandsOptions,
  context: ExecutorContext
): AsyncGenerator<{ task: string; result: TaskResult }> {
  const projectName = taskGraph.tasks[taskGraph.roots[0]]?.target?.project;
  const projectRoot = context.projectGraph.nodes[projectName]?.data?.root ?? '';
  const customGradleExecutableDirectory =
    getCustomGradleExecutableDirectoryFromPlugin(context.nxJsonConfiguration);

  let gradlewPath = findGradlewFile(
    join(projectRoot, 'project.json'),
    workspaceRoot,
    customGradleExecutableDirectory
  );
  gradlewPath = join(context.root, gradlewPath);
  const root = dirname(gradlewPath);

  // set args with passed in args and overrides in command line
  const input = inputs[taskGraph.roots[0]];

  const args =
    typeof input.args === 'string'
      ? input.args.trim().split(' ')
      : Array.isArray(input.args)
        ? input.args
        : [];
  if (overrides.__overrides_unparsed__.length) {
    args.push(...overrides.__overrides_unparsed__);
  }

  const taskIds = Object.keys(taskGraph.tasks);

  const { gradlewTasksToRun, excludeTasks, excludeTestTasks } =
    getGradlewTasksToRun(
      taskIds,
      taskGraph,
      inputs,
      context.projectGraph.nodes,
      context.taskGraph ?? taskGraph
    );

  const yielded = new Set<string>();

  try {
    for await (const event of streamTasksInBatch(
      gradlewTasksToRun,
      excludeTasks,
      excludeTestTasks,
      args,
      root
    )) {
      yielded.add(event.task);
      yield event;
    }
  } catch (e) {
    output.error({
      title: `Gradlew batch failed`,
      bodyLines: [e.toString()],
    });
    for (const taskId of taskIds) {
      if (!yielded.has(taskId)) {
        yielded.add(taskId);
        yield {
          task: taskId,
          result: { success: false, terminalOutput: e.toString() },
        };
      }
    }
  }
}

export function getGradlewTasksToRun(
  taskIds: string[],
  taskGraph: TaskGraph,
  inputs: Record<string, GradleExecutorSchema>,
  nodes: Record<string, ProjectGraphProjectNode>,
  fullTaskGraph: TaskGraph = taskGraph
) {
  const tasksWithExcludeIds = new Set<string>();
  const testTasksWithExcludeIds = new Set<string>();
  const tasksWithoutExcludeIds = new Set<string>();
  const gradlewTasksToRun: Record<string, GradleExecutorSchema> = {};
  const includeDependsOnTasks = new Set<string>();

  for (const taskId of taskIds) {
    const input = inputs[taskId];

    gradlewTasksToRun[taskId] = input;

    if (input.includeDependsOnTasks) {
      for (const t of input.includeDependsOnTasks) {
        includeDependsOnTasks.add(t);
      }
    }

    if (input.excludeDependsOn) {
      if (input.testClassName) {
        testTasksWithExcludeIds.add(taskId);
      } else {
        tasksWithExcludeIds.add(taskId);
      }
    } else {
      tasksWithoutExcludeIds.add(taskId);
    }
  }

  const runningTaskIds = new Set<string>(taskIds);
  for (const depId of getAllDependsOnFromTaskGraph(
    tasksWithoutExcludeIds,
    fullTaskGraph
  )) {
    runningTaskIds.add(depId);
  }

  const excludeTasks = getExcludeTasksFromTaskGraph(
    tasksWithExcludeIds,
    runningTaskIds,
    fullTaskGraph,
    nodes,
    includeDependsOnTasks
  );

  const excludeTestTasks = getExcludeTasksFromTaskGraph(
    testTasksWithExcludeIds,
    new Set(),
    fullTaskGraph,
    nodes
  );

  return {
    gradlewTasksToRun,
    excludeTasks,
    excludeTestTasks,
  };
}

async function* streamTasksInBatch(
  gradlewTasksToRun: Record<string, GradleExecutorSchema>,
  excludeTasks: Set<string>,
  excludeTestTasks: Set<string>,
  args: string[],
  root: string
): AsyncGenerator<{ task: string; result: TaskResult }> {
  const gradlewBatchStart = performance.mark(`gradlew-batch:start`);

  const debugOptions = (process.env.NX_GRADLE_BATCH_DEBUG ?? '').trim();
  const spawnArgs = [
    ...(debugOptions ? debugOptions.split(/\s+/) : []),
    '-jar',
    batchRunnerPath,
    `--tasks=${JSON.stringify(gradlewTasksToRun)}`,
    `--workspaceRoot=${root}`,
    `--args=${args.join(' ').replaceAll("'", '"')}`,
    `--excludeTasks=${Array.from(excludeTasks).join(',')}`,
    `--excludeTestTasks=${Array.from(excludeTestTasks).join(',')}`,
    ...(process.env.NX_VERBOSE_LOGGING === 'true' ? [] : ['--quiet']),
  ];

  // stderr is inherited so Gradle output (tee'd to System.err by TeeOutputStream)
  // and logger output flow to the terminal in real-time.
  // stdout is piped so we can read NX_RESULT lines emitted per task.
  const cp = spawn('java', spawnArgs, {
    cwd: workspaceRoot,
    windowsHide: true,
    env: process.env,
    stdio: ['pipe', 'pipe', 'inherit'],
  });

  const exit = new Promise<number>((resolve, reject) => {
    cp.on('error', reject);
    cp.on('close', (code) => resolve(code ?? 0));
  });

  const rl = createInterface({ input: cp.stdout, crlfDelay: Infinity });

  // Drain stdout into a queue eagerly. Yielding inside the readline loop creates
  // back-pressure: if the consumer is slow, `yield` blocks, readline pauses, the
  // OS pipe between Java and Node fills, and Java's NX_RESULT println blocks on
  // a full pipe — the JVM hangs even though all task work is done.
  const queue: Array<{ task: string; result: TaskResult }> = [];
  let notifyAvailable: (() => void) | null = null;
  let readerClosed = false;

  rl.on('line', (line) => {
    if (!line.startsWith('NX_RESULT:')) return;
    try {
      const data = JSON.parse(line.slice('NX_RESULT:'.length));
      queue.push({
        task: data.task,
        result: {
          success: data.result.success ?? false,
          status: data.result.status,
          terminalOutput: data.result.terminalOutput ?? '',
          startTime: data.result.startTime,
          endTime: data.result.endTime,
        },
      });
    } catch (e) {
      console.error('[Gradle Batch] Failed to parse result line:', line, e);
      return;
    }
    notifyAvailable?.();
    notifyAvailable = null;
  });
  rl.on('close', () => {
    readerClosed = true;
    notifyAvailable?.();
    notifyAvailable = null;
  });

  try {
    while (!readerClosed || queue.length > 0) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else {
        await new Promise<void>((resolve) => {
          notifyAvailable = resolve;
        });
      }
    }
  } finally {
    rl.close();
  }

  const code = await exit;

  const gradlewBatchEnd = performance.mark(`gradlew-batch:end`);
  performance.measure(
    `gradlew-batch`,
    gradlewBatchStart.name,
    gradlewBatchEnd.name
  );

  if (code !== 0) {
    throw new Error(`Gradle batch runner exited with code ${code}`);
  }
}
