import { ExecutorContext, TaskGraph, workspaceRoot } from '@nx/devkit';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';
import { TaskResult } from 'nx/src/config/misc-interfaces';
import { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';
import { MavenExecutorSchema } from './schema';
import * as net from 'net';

/**
 * Get path to the batch runner JAR
 */
function getBatchRunnerJar(): string {
  const jarPath = resolve(__dirname, '../../../dist/batch-runner.jar');
  if (!existsSync(jarPath)) {
    throw new Error(`Maven batch runner JAR not found at: ${jarPath}`);
  }
  return jarPath;
}

/**
 * Normalize Maven arguments
 */
function normalizeMavenArgs(args: string[] | string | undefined): string[] {
  if (!args) return [];
  if (Array.isArray(args)) return args;
  return args
    .trim()
    .split(' ')
    .filter((arg) => arg.length > 0);
}

/**
 * Build task data for batch runner
 */
interface TaskData {
  phase?: string;
  goals: string[];
  args: string[];
  project?: string;
}

function buildTaskData(
  options: MavenExecutorSchema,
  projectName?: string
): TaskData {
  return {
    phase: options.phase,
    goals: Array.isArray(options.goals)
      ? options.goals
      : options.goals
        ? [options.goals]
        : [],
    args: normalizeMavenArgs(options.args),
    project: projectName,
  };
}

/**
 * Build tasks map from task graph and inputs
 */
function buildTasks(
  taskGraph: TaskGraph,
  inputs: Record<string, MavenExecutorSchema>
): Record<string, TaskData> {
  const tasks: Record<string, TaskData> = {};
  for (const taskId of Object.keys(taskGraph.tasks)) {
    const task = taskGraph.tasks[taskId];
    const projectName = task.target.project;
    const options = inputs[taskId];
    tasks[taskId] = buildTaskData(options, projectName);
  }
  return tasks;
}

/**
 * Maven batch executor using Kotlin batch runner with Maven Invoker API.
 * Streams task results as they complete via async generator.
 */
export default async function* mavenBatchExecutor(
  taskGraph: TaskGraph,
  inputs: Record<string, MavenExecutorSchema>,
  overrides: RunCommandsOptions,
  context: ExecutorContext
): AsyncGenerator<{ task: string; result: TaskResult }> {
  // Get batch runner JAR path
  const batchRunnerJar = getBatchRunnerJar();

  // Build task map for batch runner
  const tasks = buildTasks(taskGraph, inputs);

  // Set up TCP server for communication
  const server = net.createServer();
  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as net.AddressInfo;
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log(
          `[Maven Batch] TCP server listening on 127.0.0.1:${address.port}`
        );
      }
      resolve(address.port);
    });
  });

  const resultsQueue: { task: string; result: TaskResult }[] = [];
  let resolveNextResult:
    | ((value: { task: string; result: TaskResult } | null) => void)
    | null = null;
  let isDone = false;

  server.on('connection', (socket) => {
    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log('[Maven Batch] Connection established with batch runner');
    }
    const rl = createInterface({
      input: socket,
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log(`[Maven Batch] Received line: ${line}`);
      }
      try {
        const data = JSON.parse(line);
        const result = {
          task: data.task,
          result: {
            success: data.result.success ?? false,
            terminalOutput: data.result.terminalOutput ?? '',
            startTime: data.result.startTime,
            endTime: data.result.endTime,
          },
        };

        if (resolveNextResult) {
          resolveNextResult(result);
          resolveNextResult = null;
        } else {
          resultsQueue.push(result);
        }
      } catch (e) {
        console.error('[Maven Batch] Failed to parse result line:', line, e);
      }
    });
  });

  // Build arguments for batch runner
  const args: string[] = [];
  if (overrides.__overrides_unparsed__?.length) {
    args.push(...overrides.__overrides_unparsed__);
  }

  // Prepare batch runner arguments
  const javaArgs = [
    '-jar',
    batchRunnerJar,
    `--workspaceRoot=${workspaceRoot}`,
    `--communicationPort=${port}`,
  ];

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    javaArgs.push('--verbose');
    console.log(`[Maven Batch] Executing: java ${javaArgs.join(' ')}`);
  }

  // Create combined payload for stdin with taskGraph, tasks, and args
  const stdinPayload = {
    taskGraph,
    tasks,
    args,
  };

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    console.log(
      `[Maven Batch] Sending stdin payload (${JSON.stringify(stdinPayload).length} bytes)`
    );
  }

  // Spawn batch runner process
  // stdin: pipe (send task data), stdout: inherit (Maven output), stderr: inherit (log output)
  const child = spawn('java', javaArgs, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: ['pipe', 'inherit', 'inherit'],
    windowsHide: true,
  });

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    console.log(`[Maven Batch] Spawned process ${child.pid}`);
  }

  // Send task data via stdin (ignore EPIPE if process exits early)
  child.stdin.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EPIPE') {
      console.error('[Maven Batch] stdin error:', err);
    }
  });
  child.stdin.write(JSON.stringify(stdinPayload));
  child.stdin.end();

  // Promise to track process exit
  const processExitPromise = new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      isDone = true;
      if (resolveNextResult) {
        resolveNextResult(null);
      }
      server.close();

      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log(`[Maven Batch] Process exited with code: ${code}`);
      }
      if (code !== 0) {
        reject(new Error(`Maven batch runner exited with code ${code}`));
      } else {
        resolve();
      }
    });
    child.on('error', (err) => {
      isDone = true;
      if (resolveNextResult) {
        resolveNextResult(null);
      }
      server.close();
      reject(err);
    });
  });

  // Yield results as they come in through the TCP server
  while (!isDone || resultsQueue.length > 0) {
    if (resultsQueue.length > 0) {
      yield resultsQueue.shift()!;
    } else if (!isDone) {
      const nextResult = await new Promise<{
        task: string;
        result: TaskResult;
      } | null>((resolve) => {
        resolveNextResult = resolve;
      });
      if (nextResult) {
        yield nextResult;
      }
    }
  }

  // Wait for process to exit and check exit code
  await processExitPromise;
}
