/**
 * Batch runner for Maven - handles multi-task Maven execution
 * This is a simplified implementation that can later be migrated to Kotlin/Java
 * for more advanced features like true parallel execution and result parsing
 */

import { spawn } from 'child_process';
import { BatchResults } from 'nx/src/tasks-runner/batch/batch-messages';

export interface BatchTask {
  id: string;
  phase?: string;
  goals?: string[];
  args?: string[];
}

export interface BatchRunnerOptions {
  workspaceRoot: string;
  mavenExecutable: string;
  tasks: BatchTask[];
  verbose?: boolean;
}

/**
 * Run Maven tasks in batch
 * Groups tasks by shared targets and executes them in batches
 */
export async function runMavenBatch(
  options: BatchRunnerOptions
): Promise<BatchResults> {
  const results: BatchResults = {};

  // Group tasks by target combination
  const taskGroups = groupTasksByTargets(options.tasks);

  try {
    // Execute each group
    for (const group of taskGroups) {
      const args = buildMavenArgs(group);

      if (options.verbose) {
        console.log(
          `[Maven Batch] Executing group with targets: ${args.join(' ')}`
        );
      }

      const success = await executeMavenCommand(
        options.mavenExecutable,
        args,
        options.workspaceRoot,
        options.verbose
      );

      // Assign the same result to all tasks in the group
      for (const taskId of group.taskIds) {
        results[taskId] = {
          success,
          terminalOutput: `Executed with Maven batch runner`,
        };
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    for (const task of options.tasks) {
      results[task.id] = {
        success: false,
        terminalOutput: message,
      };
    }
  }

  return results;
}

interface TaskGroup {
  taskIds: string[];
  phase?: string;
  goals: string[];
  args: string[];
}

function groupTasksByTargets(tasks: BatchTask[]): TaskGroup[] {
  const groups = new Map<string, TaskGroup>();

  for (const task of tasks) {
    const goals = task.goals || [];
    const args = task.args || [];
    const key = JSON.stringify({
      phase: task.phase,
      goals,
      args,
    });

    if (!groups.has(key)) {
      groups.set(key, {
        taskIds: [],
        phase: task.phase,
        goals,
        args,
      });
    }

    groups.get(key)!.taskIds.push(task.id);
  }

  return Array.from(groups.values());
}

function buildMavenArgs(group: TaskGroup): string[] {
  const args: string[] = [];

  if (group.phase) {
    args.push(group.phase);
  }

  if (group.goals.length > 0) {
    args.push(...group.goals);
  }

  if (group.args.length > 0) {
    args.push(...group.args);
  }

  return args;
}

async function executeMavenCommand(
  executable: string,
  args: string[],
  cwd: string,
  verbose?: boolean
): Promise<boolean> {
  return new Promise((resolve) => {
    let hasErrors = false;

    const child = spawn(executable, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    child.stdout?.on('data', (data) => {
      const text = data.toString();
      if (verbose) {
        process.stdout.write(text);
      }
      if (text.includes('BUILD FAILURE')) {
        hasErrors = true;
      }
    });

    child.stderr?.on('data', (data) => {
      const text = data.toString();
      if (verbose) {
        process.stderr.write(text);
      }
    });

    child.on('close', (code) => {
      resolve(code === 0 && !hasErrors);
    });

    child.on('error', () => {
      resolve(false);
    });
  });
}
