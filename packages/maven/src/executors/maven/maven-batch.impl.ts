import { ExecutorContext, TaskGraph, workspaceRoot } from '@nx/devkit';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';
import { TaskResult } from 'nx/src/config/misc-interfaces';
import { RunCommandsOptions } from 'nx/src/executors/run-commands/run-commands.impl';
import { MavenExecutorSchema } from './schema';

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

  // Build arguments for batch runner
  const args: string[] = [];
  if (overrides.__overrides_unparsed__?.length) {
    args.push(...overrides.__overrides_unparsed__);
  }

  // Prepare batch runner arguments
  const javaArgs = ['-jar', batchRunnerJar, `--workspaceRoot=${workspaceRoot}`];

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

  // Spawn batch runner process
  // stdin: pipe (send task data), stdout: inherit (Maven output), stderr: pipe (results)
  const child = spawn('java', javaArgs, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: ['pipe', 'inherit', 'pipe'],
    windowsHide: true,
  });

  // Send task data via stdin (ignore EPIPE if process exits early)
  child.stdin.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code !== 'EPIPE') {
      console.error('[Maven Batch] stdin error:', err);
    }
  });
  child.stdin.write(JSON.stringify(stdinPayload));
  child.stdin.end();

  // Read stderr line by line for JSON results
  const rl = createInterface({
    input: child.stderr,
    crlfDelay: Infinity,
  });

  // Collect non-result stderr lines for error reporting
  const stderrLines: string[] = [];
  // Collect terminal output from failed tasks
  const failedTaskOutputs: string[] = [];

  // Yield results as they stream in
  for await (const line of rl) {
    if (line.startsWith('NX_RESULT:')) {
      try {
        const jsonStr = line.slice('NX_RESULT:'.length);
        const data = JSON.parse(jsonStr);
        const result = {
          success: data.result.success ?? false,
          terminalOutput: data.result.terminalOutput ?? '',
          startTime: data.result.startTime,
          endTime: data.result.endTime,
        };

        // Collect terminal output from failed tasks
        if (!result.success && result.terminalOutput) {
          failedTaskOutputs.push(result.terminalOutput);
        }

        yield {
          task: data.task,
          result,
        };
      } catch (e) {
        console.error('[Maven Batch] Failed to parse result line:', line, e);
      }
    } else if (line.trim()) {
      // Pass through debug/reflection logs immediately
      if (line.includes('[NX-REFLECTION]') || line.includes('[NX-DEBUG]')) {
        console.error(line);
      }
      // Collect non-empty stderr lines for error reporting
      stderrLines.push(line);
    }
  }

  // Wait for process to exit
  await new Promise<void>((resolve, reject) => {
    child.on('close', (code) => {
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log(`[Maven Batch] Process exited with code: ${code}`);
      }
      // If process exited unexpectedly, print captured stderr
      if (code !== 0 && stderrLines.length > 0) {
        console.error(
          `[Maven Batch] Process exited with code ${code}. Stderr output:`
        );
        for (const line of stderrLines) {
          console.error(line);
        }
      }
      // Print failed task outputs to stderr so they appear in error.message
      if (failedTaskOutputs.length > 0) {
        console.error('\n[Maven Batch] Failed task outputs:');
        for (const output of failedTaskOutputs) {
          console.error(output);
        }
      }
      resolve();
    });
    child.on('error', reject);
  });
}
