import { ExecutorContext, output, TaskGraph, workspaceRoot } from '@nx/devkit';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { createInterface } from 'readline';
import { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';
import { MavenExecutorSchema } from './schema';

interface TaskResult {
  success: boolean;
  terminalOutput: string;
  startTime?: number;
  endTime?: number;
}

/**
 * Get path to the batch runner JAR
 */
function getBatchRunnerJar(): string {
  // Try multiple locations
  const possiblePaths = [
    // Fallback relative to this file's dist location
    resolve(__dirname, '../../../dist/batch-runner.jar'),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  throw new Error(
    `Maven batch runner JAR not found. Tried: ${possiblePaths.join(', ')}`
  );
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
  const tasks: Record<string, TaskData> = {};
  const taskIds = Object.keys(taskGraph.tasks);

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    console.log('[Maven Batch] Building tasks for execution:');
  }

  for (const taskId of taskIds) {
    const task = taskGraph.tasks[taskId];
    const projectName = task.target.project;
    const options = inputs[taskId] || inputs[projectName];
    tasks[taskId] = buildTaskData(options, projectName);

    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(`[Maven Batch]   Task ID: "${taskId}"`);
    }
  }

  // Build arguments for batch runner
  const args: string[] = [];
  if (overrides.__overrides_unparsed__?.length) {
    args.push(...overrides.__overrides_unparsed__);
  }

  // Prepare batch runner arguments
  const workspaceDataDir = join(workspaceRoot, '.nx');

  const javaArgs = [
    '-jar',
    batchRunnerJar,
    `--workspaceRoot=${workspaceRoot}`,
    `--workspaceDataDirectory=${workspaceDataDir}`,
  ];

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    javaArgs.push('--verbose');
  }

  if (process.env.NX_VERBOSE_LOGGING === 'true') {
    console.log(`[Maven Batch] Executing: java ${javaArgs.join(' ')}`);
  }

  // Create combined payload for stdin with taskGraph, tasks, and args
  const stdinPayload = {
    taskGraph,
    tasks,
    args,
  };

  // Spawn batch runner process
  // stdin: pipe (send task data), stdout: inherit (Maven output), stderr: pipe (results)
  const child = spawn('java', javaArgs, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: ['pipe', 'inherit', 'pipe'],
    windowsHide: true,
  });

  // Send task data via stdin
  child.stdin.write(JSON.stringify(stdinPayload));
  child.stdin.end();

  // Read stderr line by line for JSON results
  const rl = createInterface({
    input: child.stderr,
    crlfDelay: Infinity,
  });

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
          },
        };
      } catch (e) {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
          console.error('[Maven Batch] Failed to parse result line:', line, e);
        }
      }
    }
  }

  // Wait for process to exit
  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log(`[Maven Batch] Process exited with code: ${code}`);
      }
      resolve();
    });
    child.on('error', reject);
  });
}
