import {
  ExecutorContext,
  output,
  ProjectGraphProjectNode,
  TaskGraph,
  workspaceRoot,
} from '@nx/devkit';
import { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';
import { BatchTaskResult } from 'nx/src/tasks-runner/batch/batch-messages';
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
  getAllDependsOn,
  getExcludeTasks,
  getGradleTaskNameWithNxTaskId,
} from './get-exclude-task';

export const batchRunnerPath = join(
  __dirname,
  '../../../batch-runner/build/libs/batch-runner-all.jar'
);

/**
 * Gradle batch executor using Kotlin batch runner with Gradle Tooling API.
 * Streams task results as they complete via async generator.
 */
export default async function* gradleBatchExecutor(
  taskGraph: TaskGraph,
  inputs: Record<string, GradleExecutorSchema>,
  overrides: RunCommandsOptions,
  context: ExecutorContext
): AsyncGenerator<BatchTaskResult> {
  const taskIds = Object.keys(taskGraph.tasks);

  try {
    const projectName = taskGraph.tasks[taskGraph.roots[0]]?.target?.project;
    let projectRoot = context.projectGraph.nodes[projectName]?.data?.root ?? '';
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

    let args =
      typeof input.args === 'string'
        ? input.args.trim().split(' ')
        : Array.isArray(input.args)
          ? input.args
          : [];
    if (overrides.__overrides_unparsed__.length) {
      args.push(...overrides.__overrides_unparsed__);
    }

    const { gradlewTasksToRun, excludeTasks, excludeTestTasks } =
      getGradlewTasksToRun(
        taskIds,
        taskGraph,
        inputs,
        context.projectGraph.nodes
      );

    // Stream results as they complete
    const receivedTasks = new Set<string>();
    for await (const result of runTasksInBatchStreaming(
      gradlewTasksToRun,
      excludeTasks,
      excludeTestTasks,
      args,
      root
    )) {
      receivedTasks.add(result.task);
      yield result;
    }

    // Emit failures for any tasks that didn't report results
    for (const taskId of taskIds) {
      if (!receivedTasks.has(taskId)) {
        yield {
          task: taskId,
          result: {
            success: false,
            terminalOutput: `Gradlew batch failed - task did not report result`,
          },
        };
      }
    }
  } catch (e) {
    output.error({
      title: `Gradlew batch failed`,
      bodyLines: [e.toString()],
    });
    // Emit failures for all tasks
    for (const taskId of taskIds) {
      yield {
        task: taskId,
        result: { success: false, terminalOutput: e.toString() },
      };
    }
  }
}

/**
 * Get the gradlew task ids to run
 */
export function getGradlewTasksToRun(
  taskIds: string[],
  taskGraph: TaskGraph,
  inputs: Record<string, GradleExecutorSchema>,
  nodes: Record<string, ProjectGraphProjectNode>
) {
  const taskIdsWithExclude: Set<string> = new Set([]);
  const testTaskIdsWithExclude: Set<string> = new Set([]);
  const taskIdsWithoutExclude: Set<string> = new Set([]);
  const gradlewTasksToRun: Record<string, GradleExecutorSchema> = {};
  const includeDependsOnTasks: Set<string> = new Set();

  for (const taskId of taskIds) {
    const task = taskGraph.tasks[taskId];
    const input = inputs[task.id];

    gradlewTasksToRun[taskId] = input;

    // Collect tasks that should be included (not excluded) - typically provider-based dependencies
    if (input.includeDependsOnTasks) {
      for (const task of input.includeDependsOnTasks) {
        includeDependsOnTasks.add(task);
      }
    }

    if (input.excludeDependsOn) {
      if (input.testClassName) {
        testTaskIdsWithExclude.add(taskId);
      } else {
        taskIdsWithExclude.add(taskId);
      }
    } else {
      taskIdsWithoutExclude.add(taskId);
    }
  }

  const allDependsOn = new Set<string>(taskIds);
  for (const taskId of taskIdsWithoutExclude) {
    const [projectName, targetName] = taskId.split(':');
    const dependencies = getAllDependsOn(nodes, projectName, targetName);
    dependencies.forEach((dep) => allDependsOn.add(dep));
  }

  const excludeTasks = getExcludeTasks(
    taskIdsWithExclude,
    nodes,
    allDependsOn,
    includeDependsOnTasks
  );

  const allTestsDependsOn = new Set<string>();
  for (const taskId of testTaskIdsWithExclude) {
    const [projectName, targetName] = taskId.split(':');
    const taskDependsOn = getAllDependsOn(nodes, projectName, targetName);
    taskDependsOn.forEach((dep) => allTestsDependsOn.add(dep));
  }
  const excludeTestTasks = new Set<string>();
  for (let taskId of allTestsDependsOn) {
    const gradleTaskName = getGradleTaskNameWithNxTaskId(taskId, nodes);
    if (gradleTaskName) {
      excludeTestTasks.add(gradleTaskName);
    }
  }

  return {
    gradlewTasksToRun,
    excludeTasks,
    excludeTestTasks,
  };
}

/**
 * Run tasks in batch with streaming results.
 * - stdout is inherited (Gradle output streams to terminal in real-time)
 * - stderr is piped to read NX_RESULT:{json} lines for task completion
 */
async function* runTasksInBatchStreaming(
  gradlewTasksToRun: Record<string, GradleExecutorSchema>,
  excludeTasks: Set<string>,
  excludeTestTasks: Set<string>,
  args: string[],
  root: string
): AsyncGenerator<BatchTaskResult> {
  const gradlewBatchStart = performance.mark(`gradlew-batch:start`);

  // Build command arguments
  const debugArgs = (process.env.NX_GRADLE_BATCH_DEBUG ?? '')
    .trim()
    .split(' ')
    .filter(Boolean);
  const javaArgs = [
    ...debugArgs,
    '-jar',
    batchRunnerPath,
    `--tasks=${JSON.stringify(gradlewTasksToRun)}`,
    `--workspaceRoot=${root}`,
    `--args=${args.join(' ').replaceAll("'", '"')}`,
    `--excludeTasks=${Array.from(excludeTasks).join(',')}`,
    `--excludeTestTasks=${Array.from(excludeTestTasks).join(',')}`,
  ];

  if (process.env.NX_VERBOSE_LOGGING !== 'true') {
    javaArgs.push('--quiet');
  }

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    console.log(`[Gradle Batch] Executing: java ${javaArgs.join(' ')}`);
  }

  // Spawn batch runner process
  // stdin: ignore (no input needed)
  // stdout: inherit (Gradle output streams to terminal in real-time)
  // stderr: pipe (read NX_RESULT:{json} lines for task completion)
  const child = spawn('java', javaArgs, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: ['ignore', 'inherit', 'pipe'],
    windowsHide: true,
  });

  // Read stderr line by line for NX_RESULT JSON
  const rl = createInterface({
    input: child.stderr,
    crlfDelay: Infinity,
  });

  // Collect non-result stderr lines for error reporting
  const stderrLines: string[] = [];

  // Yield results as they stream in
  for await (const line of rl) {
    if (line.startsWith('NX_RESULT:')) {
      try {
        const jsonStr = line.slice('NX_RESULT:'.length);
        const data = JSON.parse(jsonStr);

        yield {
          task: data.task,
          result: {
            success: data.result.success ?? false,
            terminalOutput: data.result.terminalOutput ?? '',
            startTime: data.result.startTime,
            endTime: data.result.endTime,
          } as TaskResult,
        };
      } catch (e) {
        console.error('[Gradle Batch] Failed to parse result line:', line, e);
      }
    } else if (line.trim()) {
      // Collect non-empty stderr lines for error reporting
      stderrLines.push(line);
    }
  }

  // Wait for process to exit
  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log(`[Gradle Batch] Process exited with code: ${code}`);
      }
      if (code !== 0 && stderrLines.length > 0) {
        console.error(`[Gradle Batch] Stderr output:`);
        for (const line of stderrLines) {
          console.error(line);
        }
      }
      resolve();
    });
    child.on('error', reject);
  });

  const gradlewBatchEnd = performance.mark(`gradlew-batch:end`);
  performance.measure(
    `gradlew-batch`,
    gradlewBatchStart.name,
    gradlewBatchEnd.name
  );
}
