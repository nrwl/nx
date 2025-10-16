import { ExecutorContext, TaskGraph, output, workspaceRoot } from '@nx/devkit';
import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import {
  LARGE_BUFFER,
  RunCommandsOptions,
} from 'nx/src/executors/run-commands/run-commands.impl';
import { BatchResults } from 'nx/src/tasks-runner/batch/batch-messages';
import { MavenExecutorSchema } from './schema';

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
 * Maven batch executor using Kotlin batch runner with Maven Invoker API
 */
export default async function mavenBatchExecutor(
  taskGraph: TaskGraph,
  inputs: Record<string, MavenExecutorSchema>,
  overrides: RunCommandsOptions,
  context: ExecutorContext
): Promise<BatchResults> {
  try {
    const batchStart = performance.mark('maven-batch:start');

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

    // Prepare batch runner arguments - JSON output to stdout like Gradle
    const tasksJson = JSON.stringify(tasks).replaceAll("'", '"');
    const argsJson = args.join(' ').replaceAll("'", '"');
    const workspaceDataDir = join(workspaceRoot, '.nx');

    const command = `java -jar "${batchRunnerJar}" --workspaceRoot="${workspaceRoot}" --workspaceDataDirectory="${workspaceDataDir}" --tasks='${tasksJson}' --args='${argsJson}'${
      process.env.NX_VERBOSE_LOGGING === 'true' ? '' : ' --quiet'
    }`;

    if (process.env.NX_VERBOSE_LOGGING === 'true') {
      console.log(`[Maven Batch] Executing: ${command}`);
    }

    let batchResults: string;
    try {
      // Execute batch runner - output goes to terminal in real-time
      // We capture the result but the user sees Maven output on their terminal
      const buffer = execSync(command, {
        cwd: workspaceRoot,
        input: JSON.stringify(taskGraph),
        windowsHide: true,
        env: process.env,
        maxBuffer: LARGE_BUFFER,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'inherit'], // Capture stdout, inherit stderr so logs show
      });
      batchResults = buffer.toString();
    } catch (e) {
      // Batch runner may exit with non-zero code if tasks fail
      // Try to extract JSON output from the error buffer
      if (e.stdout) {
        batchResults = e.stdout.toString();
      } else if (e.message) {
        console.error('[Maven Batch] Error:', e.message);
        throw e;
      }
    }

    // Parse JSON results from stdout
    let results: BatchResults = {};
    try {
      // Extract JSON from output (may have logs before it)
      const startIndex = batchResults.indexOf('{');
      const endIndex = batchResults.lastIndexOf('}');

      if (startIndex >= 0 && endIndex > startIndex) {
        const jsonStr = batchResults.substring(startIndex, endIndex + 1);
        const rawResults = JSON.parse(jsonStr);

        if (process.env.NX_VERBOSE_LOGGING === 'true') {
          console.log('[Maven Batch] Expected task IDs:', taskIds);
        }

        results = Object.entries(rawResults).reduce(
          (acc, [taskId, taskResult]) => {
            const result = taskResult as any;
            acc[taskId] = {
              success: result.success ?? false,
              terminalOutput: result.terminalOutput ?? '',
            };
            console.log(result.terminalOutput);
            return acc;
          },
          {} as BatchResults
        );
      } else {
        throw new Error('No JSON found in batch runner output');
      }
    } catch (e) {
      console.warn('Failed to parse batch runner results:', e);
      if (process.env.NX_VERBOSE_LOGGING === 'true') {
        console.log('[Maven Batch] Output was:', batchResults);
      }
    }

    // Ensure all tasks have results
    for (const taskId of taskIds) {
      if (!results[taskId]) {
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
          console.log(`[Maven Batch] Missing result for task ID: "${taskId}"`);
          console.log(
            `[Maven Batch] Available task IDs in results:`,
            Object.keys(results)
          );
        }
        results[taskId] = {
          success: false,
          terminalOutput: 'No result returned from batch runner',
        };
      }
    }

    const batchEnd = performance.mark('maven-batch:end');
    performance.measure('maven-batch', batchStart.name, batchEnd.name);

    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    output.error({
      title: 'Maven batch execution failed',
      bodyLines: [errorMessage],
    });

    const results: BatchResults = {};
    for (const taskId of Object.keys(taskGraph.tasks)) {
      results[taskId] = {
        success: false,
        terminalOutput: errorMessage,
      };
    }
    return results;
  }
}
